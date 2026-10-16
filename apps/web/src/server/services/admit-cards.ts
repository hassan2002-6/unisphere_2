import { prisma } from "@/lib/db";
import type { Role, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

/**
 * Admit-card workflow (spec §10) — configurable prerequisites + an internal
 * preview PDF. The rule is a singleton row (id "singleton").
 *
 * Two checks are backed by real portal records: APPROVED form submissions and
 * enrollments. Fee clearance is deliberately NOT modelled in the database —
 * the portal keeps no fee ledger, so storing a “fee paid” tick would invent
 * data the portal does not have. The flag only adds a soft, non-blocking note
 * telling staff/students to confirm at the accounts office, and it can never
 * block eligibility.
 */

export const ADMIT_CARD_RULE_ID = "singleton";

export type AdmitCardRuleInput = {
  /** FormTemplate key whose APPROVED submission the student must have, or null. */
  requiredFormKey: string | null;
  requireEnrollment: boolean;
  feeClearanceEnabled: boolean;
  examLabel: string;
};

export type AdmitCardRule = AdmitCardRuleInput & { updatedAt: Date };

/** Defaults mirror the seeded demo row so a fresh database still gets a working config. */
const DEFAULT_RULE: AdmitCardRuleInput = {
  requiredFormKey: "faculty-form",
  requireEnrollment: true,
  feeClearanceEnabled: false,
  examLabel: "Semester Examinations",
};

export type AdmitCardCheckKey = "required_form" | "enrollment" | "fee_clearance";

export type AdmitCardCheck = {
  key: AdmitCardCheckKey;
  label: string;
  passed: boolean;
  detail: string;
  /** Soft checks never block eligibility — they are office-verification notes. */
  soft?: boolean;
};

export type AdmitCardEligibility = { eligible: boolean; checks: AdmitCardCheck[] };

/** Raw facts the pure predicate needs (gathered from the database). */
export type AdmitCardFacts = {
  /** Template keys the student holds an APPROVED submission for. */
  approvedFormKeys: readonly string[];
  enrollmentCount: number;
};

export type AdmitCardStudent = {
  id: string;
  name: string;
  registrationNo: string | null;
  email: string;
  department: string | null;
};

function toRule(row: {
  requiredFormKey: string | null;
  requireEnrollment: boolean;
  feeClearanceEnabled: boolean;
  examLabel: string;
  updatedAt: Date;
}): AdmitCardRule {
  return {
    requiredFormKey: row.requiredFormKey,
    requireEnrollment: row.requireEnrollment,
    feeClearanceEnabled: row.feeClearanceEnabled,
    examLabel: row.examLabel,
    updatedAt: row.updatedAt,
  };
}

/** The singleton rule — created with demo defaults on first read. */
export async function getAdmitCardRule(): Promise<AdmitCardRule> {
  const row = await prisma.admitCardRule.upsert({
    where: { id: ADMIT_CARD_RULE_ID },
    update: {},
    create: { id: ADMIT_CARD_RULE_ID, ...DEFAULT_RULE },
  });
  return toRule(row);
}

function normalizeRule(input: AdmitCardRuleInput): AdmitCardRuleInput {
  const examLabel = input.examLabel.trim().slice(0, 80);
  if (examLabel.length < 3) throw new ServiceError("validation_error", "Give the exam period a label (3+ characters)", 422);
  const rawKey = input.requiredFormKey?.trim() ?? "";
  return {
    requiredFormKey: rawKey ? rawKey.slice(0, 80) : null,
    requireEnrollment: Boolean(input.requireEnrollment),
    feeClearanceEnabled: Boolean(input.feeClearanceEnabled),
    examLabel,
  };
}

/** Save the singleton rule (admin only, capability admitcards.manage). */
export async function setAdmitCardRule(actor: User, input: AdmitCardRuleInput): Promise<AdmitCardRule> {
  if (!can(actor.role, "admitcards.manage")) {
    throw new ServiceError("forbidden", "Not permitted to configure admit cards", 403);
  }
  const rule = normalizeRule(input);
  if (rule.requiredFormKey) {
    const tpl = await prisma.formTemplate.findUnique({ where: { key: rule.requiredFormKey }, select: { id: true, active: true } });
    if (!tpl) {
      throw new ServiceError("validation_error", `No form template with key "${rule.requiredFormKey}" — pick an existing form (or “none”).`, 422);
    }
    if (!tpl.active) {
      throw new ServiceError("validation_error", `Form “${rule.requiredFormKey}” is inactive — reactivate it first or pick another form.`, 422);
    }
  }
  const saved = await prisma.admitCardRule.upsert({
    where: { id: ADMIT_CARD_RULE_ID },
    update: rule,
    create: { id: ADMIT_CARD_RULE_ID, ...rule },
  });
  await recordAudit({
    actorId: actor.id,
    action: "admitcards.rule_update",
    entity: "AdmitCardRule",
    entityId: ADMIT_CARD_RULE_ID,
    summary: `Admit-card rule saved — required form: ${rule.requiredFormKey ?? "none"}; enrollment: ${
      rule.requireEnrollment ? "required" : "not required"
    }; fee-clearance note: ${rule.feeClearanceEnabled ? "shown" : "hidden"}; exam: “${rule.examLabel}”`,
  });
  return toRule(saved);
}

/**
 * Pure eligibility predicate — no database access, so every outcome
 * (missing form, no enrollment, requirements disabled) is unit-testable.
 * `eligible` iff every hard check passes; soft checks are notes only.
 */
export function evaluateEligibility(
  rule: Pick<AdmitCardRuleInput, "requiredFormKey" | "requireEnrollment" | "feeClearanceEnabled">,
  facts: AdmitCardFacts,
): AdmitCardEligibility {
  const checks: AdmitCardCheck[] = [];

  if (rule.requiredFormKey) {
    const passed = facts.approvedFormKeys.includes(rule.requiredFormKey);
    checks.push({
      key: "required_form",
      label: `Required form: ${rule.requiredFormKey}`,
      passed,
      detail: passed
        ? `An approved “${rule.requiredFormKey}” submission is on record.`
        : `No approved “${rule.requiredFormKey}” submission yet — submit the form from Forms and get it approved.`,
    });
  }

  if (rule.requireEnrollment) {
    const passed = facts.enrollmentCount > 0;
    checks.push({
      key: "enrollment",
      label: "Enrollment",
      passed,
      detail: passed
        ? `Enrolled in ${facts.enrollmentCount} class${facts.enrollmentCount === 1 ? "" : "es"}.`
        : "No enrollment record found — contact the coordination office to enrol you in your classes.",
    });
  }

  if (rule.feeClearanceEnabled) {
    checks.push({
      key: "fee_clearance",
      label: "Fee clearance",
      // Soft and non-blocking by design: the portal keeps no fee ledger, so
      // this can only be an office-verification note — never a blocker.
      passed: true,
      soft: true,
      detail: "Fee clearance is not tracked in the portal — confirm at the accounts office before the exam.",
    });
  }

  return { eligible: checks.every((c) => c.passed), checks };
}

/** Exactly the hard prerequisites still outstanding (soft notes excluded). */
export function missingPrerequisites(checks: readonly AdmitCardCheck[]): AdmitCardCheck[] {
  return checks.filter((c) => !c.passed && !c.soft);
}

/** Batched fact collection so eligibility boards do not run a query per student. */
async function collectFacts(rule: AdmitCardRuleInput, studentIds: readonly string[]): Promise<Map<string, AdmitCardFacts>> {
  const facts = new Map<string, AdmitCardFacts>();
  for (const id of studentIds) facts.set(id, { approvedFormKeys: [], enrollmentCount: 0 });
  if (studentIds.length === 0) return facts;

  if (rule.requiredFormKey) {
    const tpl = await prisma.formTemplate.findUnique({ where: { key: rule.requiredFormKey }, select: { id: true } });
    if (tpl) {
      const approved = await prisma.formSubmission.findMany({
        where: { templateId: tpl.id, status: "APPROVED", submittedById: { in: [...studentIds] } },
        select: { submittedById: true },
      });
      for (const row of approved) {
        const fact = facts.get(row.submittedById);
        if (fact) fact.approvedFormKeys = [...fact.approvedFormKeys, rule.requiredFormKey];
      }
    }
  }

  if (rule.requireEnrollment) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: [...studentIds] } },
      select: { studentId: true },
    });
    for (const row of enrollments) {
      const fact = facts.get(row.studentId);
      if (fact) fact.enrollmentCount += 1;
    }
  }

  return facts;
}

export type AdmitCardRequiredTemplate = {
  key: string;
  title: string;
  audienceRole: Role;
  active: boolean;
};

export type AdmitCardEligibilityReport = AdmitCardEligibility & {
  student: AdmitCardStudent;
  rule: AdmitCardRule;
  /** The required form (when configured) — callers link to it only when the viewer can actually submit it. */
  requiredTemplate: AdmitCardRequiredTemplate | null;
};

/**
 * Eligibility for one student. Students may only check themselves; holders of
 * admitcards.manage (admin) may check anyone — the same boundary the download
 * route enforces.
 */
export async function getEligibility(subject: Pick<User, "id" | "role">, studentId: string): Promise<AdmitCardEligibilityReport> {
  if (subject.id !== studentId && !can(subject.role, "admitcards.manage")) {
    throw new ServiceError("forbidden", "You can only check your own admit-card eligibility", 403);
  }
  const [rule, student] = await Promise.all([
    getAdmitCardRule(),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, registrationNo: true, email: true, department: true, role: true },
    }),
  ]);
  if (!student || student.role !== "STUDENT") throw new ServiceError("not_found", "Student not found", 404);

  const facts = await collectFacts(rule, [student.id]);
  const eligibility = evaluateEligibility(rule, facts.get(student.id) ?? { approvedFormKeys: [], enrollmentCount: 0 });
  let requiredTemplate: AdmitCardRequiredTemplate | null = null;
  if (rule.requiredFormKey) {
    const tpl = await prisma.formTemplate.findUnique({
      where: { key: rule.requiredFormKey },
      select: { key: true, title: true, audienceRole: true, active: true },
    });
    requiredTemplate = tpl ?? null;
  }
  return {
    ...eligibility,
    student: {
      id: student.id,
      name: student.name,
      registrationNo: student.registrationNo,
      email: student.email,
      department: student.department,
    },
    rule,
    requiredTemplate,
  };
}

export type AdmitCardBoardRow = { student: AdmitCardStudent; eligibility: AdmitCardEligibility };

/** Admin eligibility board: every active student with their checks. */
export async function listAdmitCardBoard(actor: Pick<User, "id" | "role">): Promise<{ rule: AdmitCardRule; rows: AdmitCardBoardRow[] }> {
  if (!can(actor.role, "admitcards.manage")) {
    throw new ServiceError("forbidden", "Not permitted to view the admit-card board", 403);
  }
  const rule = await getAdmitCardRule();
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, registrationNo: true, email: true, department: true },
  });
  const facts = await collectFacts(rule, students.map((s) => s.id));
  const rows = students.map((student) => ({
    student,
    eligibility: evaluateEligibility(rule, facts.get(student.id) ?? { approvedFormKeys: [], enrollmentCount: 0 }),
  }));
  return { rule, rows };
}
