import { prisma } from "@/lib/db";
import type { FormStatus, Role, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { assertTransition } from "@/server/status";
import { buildFormSchema, formFieldsSchema, type FormFieldSpec } from "@/lib/validation";
import { toBytes } from "@/server/bytes";
import { notifyRole, notifyUser } from "./notifications";

/**
 * Forms Center service (plan M2c). Server-side validation with the same Zod
 * schema the renderer uses; every transition writes a FormEvent and notifies
 * per the §6.6 matrix, atomically with the state change.
 */

export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Supporting documents on submissions (spec §D “required documents”). */
export const FORM_DOC_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FORM_DOC_TYPES = ["pdf", "doc", "docx", "txt", "csv", "png", "jpg", "jpeg", "zip"] as const;
export type SubmissionAttachment = { name: string; mime: string; data: Buffer };

function validateDoc(a: SubmissionAttachment): { ok: true } | { ok: false; error: string } {
  if (!a.name || a.name.length > 200) return { ok: false, error: "Missing or invalid file name" };
  if (a.data.length <= 0) return { ok: false, error: "The attached document is empty" };
  if (a.data.length > FORM_DOC_MAX_BYTES) {
    return { ok: false, error: `Documents must be ${Math.round(FORM_DOC_MAX_BYTES / 1024 / 1024)} MB or smaller` };
  }
  const idx = a.name.lastIndexOf(".");
  const ext = (idx === -1 ? "" : a.name.slice(idx + 1)).toLowerCase();
  if (!(FORM_DOC_TYPES as readonly string[]).includes(ext)) {
    return { ok: false, error: `Only these document types are accepted: ${FORM_DOC_TYPES.join(", ")}` };
  }
  return { ok: true };
}

function parseFields(raw: unknown): FormFieldSpec[] {
  const parsed = formFieldsSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError("bad_template", "Template field spec is invalid", 500);
  return parsed.data;
}

/** Templates visible to the caller's role (audience), newest first. */
export async function listTemplatesFor(role: Role) {
  return prisma.formTemplate.findMany({
    where: { active: true, audienceRole: role },
    orderBy: { title: "asc" },
  });
}

export async function getTemplateByKey(key: string) {
  const tpl = await prisma.formTemplate.findUnique({ where: { key } });
  if (!tpl || !tpl.active) throw new ServiceError("not_found", "Template not found", 404);
  return tpl;
}

/** The ordered approval chain a template routes through ([reviewerRole] when unset). */
export function effectiveChain(tpl: { reviewerRole: Role; approverChain: string[] }): string[] {
  return tpl.approverChain.length > 0 ? tpl.approverChain : [tpl.reviewerRole];
}

/** Which role reviews this submission right now? */
export function currentApprover(sub: { chain: string[]; currentStep: number }, reviewerRole: Role): Role {
  if (sub.chain.length === 0) return reviewerRole;
  return (sub.chain[sub.currentStep] as Role) ?? reviewerRole;
}

/**
 * Submit a form. `payload` must satisfy the template's dynamic schema.
 * Snapshots the template fields + approval chain so later template edits can
 * never rewrite an existing submission (spec §7).
 */
export async function submitForm(user: User, templateKey: string, payload: unknown, attachment?: SubmissionAttachment | null) {
  const tpl = await getTemplateByKey(templateKey);
  if (tpl.audienceRole !== user.role) {
    throw new ServiceError("forbidden", "This form is not available for your role", 403);
  }

  const schema = buildFormSchema(parseFields(tpl.fields));
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("validation_error", "The submitted data is invalid", 422);
  }

  if (attachment) {
    const check = validateDoc(attachment);
    if (!check.ok) throw new ServiceError("validation_error", check.error, 422);
  } else if (tpl.requiresAttachment) {
    throw new ServiceError("validation_error", `This form needs a supporting document${tpl.attachmentLabel ? ` (${tpl.attachmentLabel})` : ""}`, 422);
  }

  const chain = effectiveChain(tpl);
  return prisma.$transaction(async (tx) => {
    const submission = await tx.formSubmission.create({
      data: {
        templateId: tpl.id,
        submittedById: user.id,
        payload: parsed.data as object,
        status: "SUBMITTED",
        templateVersion: tpl.version,
        templateSnapshot: tpl.fields as object,
        chain,
        currentStep: 0,
        ...(attachment
          ? {
              attachmentName: attachment.name,
              attachmentMime: attachment.mime || "application/octet-stream",
              attachmentSize: attachment.data.length,
              attachmentData: toBytes(attachment.data),
            }
          : {}),
        events: {
          create: { actorId: user.id, toStatus: "SUBMITTED", comment: "Submitted" },
        },
      },
    });
    await notifyRole(
      chain[0] as Role,
      {
        type: "FORM",
        title: `New ${tpl.title}`,
        body: `${user.name} submitted a ${tpl.title}.`,
        link: `/reviews`,
      },
      tx,
    );
    return submission;
  });
}

/** Submitter revises while corrections are requested, validating against the snapshot. */
export async function resubmitForm(user: User, id: string, payload: unknown, attachment?: SubmissionAttachment | null) {
  const sub = await prisma.formSubmission.findFirst({
    where: { id, submittedById: user.id },
    include: { template: true },
  });
  if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
  if (sub.status !== "CORRECTIONS_REQUESTED") {
    throw new ServiceError("conflict", "This submission is not awaiting corrections", 409);
  }
  const fields = sub.templateSnapshot ? parseFields(sub.templateSnapshot) : parseFields(sub.template.fields);
  const parsed = buildFormSchema(fields).safeParse(payload);
  if (!parsed.success) throw new ServiceError("validation_error", "The submitted data is invalid", 422);

  if (attachment) {
    const check = validateDoc(attachment);
    if (!check.ok) throw new ServiceError("validation_error", check.error, 422);
  } else if (sub.template.requiresAttachment && !sub.attachmentData) {
    throw new ServiceError("validation_error", "This form needs a supporting document with the corrected submission", 422);
  }

  return prisma.$transaction(async (tx) => {
    assertTransition("form", sub.status, "SUBMITTED");
    const updated = await tx.formSubmission.update({
      where: { id },
      data: {
        payload: parsed.data as object,
        status: "SUBMITTED",
        ...(attachment
          ? {
              attachmentName: attachment.name,
              attachmentMime: attachment.mime || "application/octet-stream",
              attachmentSize: attachment.data.length,
              attachmentData: toBytes(attachment.data),
            }
          : {}),
        events: { create: { actorId: user.id, fromStatus: sub.status, toStatus: "SUBMITTED", comment: "Revised after corrections" } },
      },
    });
    await notifyRole(
      currentApprover(sub, sub.template.reviewerRole),
      {
        type: "FORM",
        title: `${sub.template.title} revised`,
        body: `${user.name} resubmitted with the requested corrections.`,
        link: `/reviews`,
      },
      tx,
    );
    return updated;
  });
}

/** Own submissions with template info (list view). */
export async function listMySubmissions(user: User, opts?: { cursor?: string; take?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.formSubmission.findMany({
    where: { submittedById: user.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    omit: { attachmentData: true },
    include: { template: { select: { key: true, title: true, reviewerRole: true } } },
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/** Own submission detail (with events + reviewer names). */
export async function getMySubmission(user: User, id: string) {
  const sub = await prisma.formSubmission.findFirst({
    where: { id, submittedById: user.id },
    omit: { attachmentData: true },
    include: {
      template: true,
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
  return sub;
}

/** Supporting-document bytes — the submitter, the current-step approver, or an admin. */
export async function getSubmissionAttachment(user: User, id: string) {
  const sub = await prisma.formSubmission.findUnique({
    where: { id },
    select: {
      submittedById: true,
      attachmentName: true,
      attachmentMime: true,
      attachmentData: true,
      chain: true,
      currentStep: true,
      template: { select: { reviewerRole: true } },
    },
  });
  if (!sub?.attachmentData || !sub.attachmentName) throw new ServiceError("not_found", "No document on this submission", 404);
  // Same record-level rule as decideSubmission: being staff is not enough —
  // you must be the submission's current approver (or its submitter/an admin).
  const isSubmitter = sub.submittedById === user.id;
  const isStepReviewer = can(user.role, "forms.review") && currentApprover(sub, sub.template.reviewerRole) === user.role;
  const isAdmin = user.role === "ADMIN";
  if (!isSubmitter && !isStepReviewer && !isAdmin) {
    throw new ServiceError("forbidden", "You are not a reviewer for this submission", 403);
  }
  return { fileName: sub.attachmentName, mime: sub.attachmentMime ?? "application/octet-stream", data: sub.attachmentData };
}

/** Withdraw (submitter, before decision — plan §6.2). */
export async function withdrawSubmission(user: User, id: string) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.formSubmission.findFirst({
      where: { id, submittedById: user.id },
      include: { template: true },
    });
    if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
    assertTransition("form", sub.status, "WITHDRAWN");
    const updated = await tx.formSubmission.update({
      where: { id: sub.id },
      data: {
        status: "WITHDRAWN",
        events: { create: { actorId: user.id, fromStatus: sub.status, toStatus: "WITHDRAWN", comment: "Withdrawn by submitter" } },
      },
    });
    await notifyRole(
      sub.template.reviewerRole,
      {
        type: "FORM",
        title: `${sub.template.title} withdrawn`,
        body: `${user.name} withdrew their ${sub.template.title}.`,
        link: `/reviews`,
      },
      tx,
    );
    return updated;
  });
}

/**
 * Review queue for reviewers: submissions whose CURRENT chain step is my role.
 * Offset pagination — the chain step can't be expressed in the DB filter, so
 * rows are pre-filtered by role and final-filtered in code.
 */
export async function listReviewQueue(user: User, opts?: { take?: number; skip?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const skip = Math.max(opts?.skip ?? 0, 0);
  const rows = await prisma.formSubmission.findMany({
    where: {
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      OR: [
        { chain: { isEmpty: true }, template: { reviewerRole: user.role } },
        { chain: { has: user.role } },
      ],
    },
    orderBy: { createdAt: "asc" },
    omit: { attachmentData: true },
    include: {
      template: { select: { key: true, title: true, audienceRole: true, reviewerRole: true } },
      submittedBy: { select: { name: true, email: true, registrationNo: true } },
    },
  });
  const mine = rows.filter((s) => currentApprover(s, s.template.reviewerRole) === user.role);
  const items = mine.slice(skip, skip + take);
  return { items, hasMore: mine.length > skip + take };
}

async function advanceOrDecide(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sub: { id: string; status: FormStatus; chain: string[]; currentStep: number },
  user: User,
  template: { title: string; reviewerRole: Role },
  submitter: { id: string; name: string },
  decision: FormDecision,
  comment?: string,
) {
  const chain = sub.chain.length > 0 ? sub.chain : [template.reviewerRole];
  const isMultiStep = chain.length > 1;
  const text = comment?.slice(0, 1000) || null;

  // Intermediate approval — the form moves to the next office, still in review.
  if (decision === "APPROVED" && isMultiStep && sub.currentStep < chain.length - 1) {
    const nextRole = chain[sub.currentStep + 1] as Role;
    const updated = await tx.formSubmission.update({
      where: { id: sub.id },
      data: {
        status: sub.status === "SUBMITTED" ? "UNDER_REVIEW" : sub.status,
        currentStep: sub.currentStep + 1,
        reviewerId: user.id,
        events: {
          create: {
            actorId: user.id,
            fromStatus: sub.status,
            toStatus: "UNDER_REVIEW",
            comment: text ? `Step ${sub.currentStep + 1} approved: ${text}` : `Step ${sub.currentStep + 1} approved`,
          },
        },
      },
    });
    await notifyRole(nextRole, {
      type: "FORM",
      title: `${template.title} awaiting your review`,
      body: `Approved by ${user.name} — now with ${nextRole.replaceAll("_", " ").toLowerCase()}.`,
      link: `/reviews`,
    }, tx);
    await notifyUser(submitter.id, {
      type: "FORM",
      title: `${template.title}: progressing`,
      body: `Approved by ${user.name}; now awaiting ${nextRole.replaceAll("_", " ").toLowerCase()}.`,
      link: `/submissions/${sub.id}`,
    }, tx);
    return updated;
  }

  // Final decision — SUBMITTED moves through UNDER_REVIEW first (machine §6.2).
  if (sub.status === "SUBMITTED") assertTransition("form", sub.status, "UNDER_REVIEW");
  assertTransition("form", "UNDER_REVIEW", decision);
  const updated = await tx.formSubmission.update({
    where: { id: sub.id },
    data: {
      status: decision,
      reviewerId: user.id,
      events: {
        create: { actorId: user.id, fromStatus: sub.status, toStatus: decision, comment: text },
      },
    },
  });

  const friendly = decision.replaceAll("_", " ").toLowerCase();
  await notifyUser(submitter.id, {
    type: "FORM",
    title: `${template.title}: ${friendly}`,
    body: comment
      ? `Decision from ${user.name}: ${comment}`
      : `Your ${template.title} is now ${friendly}.`,
    link: `/submissions/${sub.id}`,
  }, tx);
  return updated;
}

export type FormDecision = Extract<FormStatus, "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CORRECTIONS_REQUESTED">;

/**
 * Reviewer decision on the submission's current step. Intermediate approvals
 * advance the chain; the final step sets APPROVED/REJECTED/CORRECTIONS_REQUESTED.
 */
export async function decideSubmission(user: User, id: string, decision: FormDecision, comment?: string) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.formSubmission.findUnique({
      where: { id },
      include: { template: true, submittedBy: { select: { id: true, name: true } } },
    });
    if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
    const approver = currentApprover(sub, sub.template.reviewerRole);
    if (approver !== user.role) {
      throw new ServiceError("forbidden", "You are not the reviewer for this step", 403);
    }
    if (sub.status === "SUBMITTED" && decision === "UNDER_REVIEW") {
      assertTransition("form", sub.status, "UNDER_REVIEW");
      const updated = await tx.formSubmission.update({
        where: { id: sub.id },
        data: {
          status: "UNDER_REVIEW",
          reviewerId: user.id,
          events: { create: { actorId: user.id, fromStatus: sub.status, toStatus: "UNDER_REVIEW", comment: comment?.slice(0, 1000) || "Review started" } },
        },
      });
      return updated;
    }
    return advanceOrDecide(tx, sub, user, sub.template, sub.submittedBy, decision, comment);
  });
}
