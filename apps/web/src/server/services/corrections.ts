import { prisma } from "@/lib/db";
import type { CorrectionStatus, Prisma, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";
import { notifyRole, notifyUser } from "./notifications";

/**
 * Data-correction requests (goal §6: faculty → authorized role).
 *
 * Faculty open a student record they cannot edit, request a field change
 * (field, new value, reason) and an administrator reviews it. Approval applies
 * the value to the real record in the same transaction that closes the
 * request; rejection records the reason; both outcomes notify the requester.
 * The current value is always captured server-side (never taken from the
 * client), only whitelisted fields are accepted, no-ops are refused and a
 * second in-flight request for the same field + record is a duplicate.
 */

// ── Whitelists (pure — unit-tested without a database) ────────────────────

export const CORRECTION_ENTITY_TYPES = ["StudentProfile", "User", "Enrollment"] as const;
export type CorrectionEntityType = (typeof CORRECTION_ENTITY_TYPES)[number];

/** Real, writable columns per record — everything else is refused. */
export const CORRECTION_FIELD_WHITELIST: Record<CorrectionEntityType, readonly string[]> = {
  StudentProfile: ["program", "semester", "batch", "section"],
  User: ["name", "registrationNo"],
  Enrollment: ["status"],
};

export const ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED", "DROPPED"] as const;

const FIELD_LABELS: Record<string, string> = {
  program: "Program",
  semester: "Semester",
  batch: "Batch",
  section: "Section",
  name: "Full name",
  registrationNo: "Registration no",
  status: "Enrollment status",
};

/** Friendly name for a whitelisted field (falls back to the raw key). */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function isCorrectionEntityType(value: string): value is CorrectionEntityType {
  return (CORRECTION_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isAllowedField(entityType: string, field: string): boolean {
  if (!isCorrectionEntityType(entityType)) return false;
  return CORRECTION_FIELD_WHITELIST[entityType].includes(field);
}

/**
 * Validate + normalise one requested value for a whitelisted field. Throws a
 * 422 ServiceError describing what the field expects. Returns the canonical
 * string that is stored on the request and applied on approval.
 */
export function normalizeCorrectionValue(
  entityType: CorrectionEntityType,
  field: string,
  rawValue: unknown,
): string {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!raw) throw new ServiceError("validation_error", "Enter the new value", 422);
  if (raw.length > 200) {
    throw new ServiceError("validation_error", "The new value is too long (200 characters max)", 422);
  }

  switch (`${entityType}.${field}`) {
    case "StudentProfile.program": {
      const value = raw.toUpperCase();
      if (!/^[A-Z]{2,6}$/.test(value)) {
        throw new ServiceError("validation_error", "Program must be a short code such as BSCS", 422);
      }
      return value;
    }
    case "StudentProfile.semester": {
      if (!/^\d{1,2}$/.test(raw)) {
        throw new ServiceError("validation_error", "Semester must be a whole number such as 7", 422);
      }
      const value = Number.parseInt(raw, 10);
      if (value < 1 || value > 12) {
        throw new ServiceError("validation_error", "Semester must be between 1 and 12", 422);
      }
      return String(value);
    }
    case "StudentProfile.batch": {
      if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,19}$/.test(raw)) {
        throw new ServiceError("validation_error", "Batch looks like BSCS-2023", 422);
      }
      return raw;
    }
    case "StudentProfile.section": {
      const value = raw.toUpperCase();
      if (!/^[A-Z0-9]{1,4}$/.test(value)) {
        throw new ServiceError("validation_error", "Section looks like A or B2", 422);
      }
      return value;
    }
    case "User.name": {
      if (raw.length < 3) {
        throw new ServiceError("validation_error", "Enter the full name (at least 3 characters)", 422);
      }
      return raw;
    }
    case "User.registrationNo": {
      const value = raw.toUpperCase();
      if (!/^S\d{2}[A-Z]{2,6}\d{3}$/.test(value)) {
        throw new ServiceError("validation_error", "Registration number looks like S22CSC001", 422);
      }
      return value;
    }
    case "Enrollment.status": {
      const value = raw.toUpperCase();
      if (!(ENROLLMENT_STATUSES as readonly string[]).includes(value)) {
        throw new ServiceError(
          "validation_error",
          `Enrollment status must be one of ${ENROLLMENT_STATUSES.join(", ")}`,
          422,
        );
      }
      return value;
    }
    default:
      throw new ServiceError("validation_error", "That field cannot be corrected", 422);
  }
}

export type CorrectionRequestInput = {
  entityType: string;
  recordId: string;
  field: string;
  /** Client copy is accepted for contract compatibility but never trusted. */
  oldValue?: string | null;
  newValue: string;
  reason: string;
};

export type ValidatedCorrectionRequest = {
  entityType: CorrectionEntityType;
  recordId: string;
  field: string;
  newValue: string;
  reason: string;
};

/** The pure half of createCorrectionRequest: whitelist + shape validation. */
export function validateCorrectionRequest(input: CorrectionRequestInput): ValidatedCorrectionRequest {
  const entityType = String(input.entityType ?? "").trim();
  const recordId = String(input.recordId ?? "").trim();
  const field = String(input.field ?? "").trim();
  const reason = String(input.reason ?? "").trim();

  if (!isCorrectionEntityType(entityType)) {
    throw new ServiceError("validation_error", `Unsupported record type: ${entityType || "(missing)"}`, 422);
  }
  if (!isAllowedField(entityType, field)) {
    throw new ServiceError(
      "validation_error",
      `“${field || "(missing)"}” is not a correctable field on ${entityType}`,
      422,
    );
  }
  if (!recordId || recordId.length > 64) {
    throw new ServiceError("validation_error", "Missing the record being corrected", 422);
  }
  if (reason.length < 5) {
    throw new ServiceError("validation_error", "Record a short reason for the correction (at least 5 characters)", 422);
  }
  if (reason.length > 500) {
    throw new ServiceError("validation_error", "The reason is too long (500 characters max)", 422);
  }

  return { entityType, recordId, field, newValue: normalizeCorrectionValue(entityType, field, input.newValue), reason };
}

/** True when the requested value already matches the stored one. */
export function isNoOp(currentValue: string | null, newValue: string): boolean {
  return (currentValue ?? "") === newValue;
}

/** Only a PENDING request may be decided. */
export function isDecidable(status: CorrectionStatus | string): boolean {
  return status === "PENDING";
}

export function assertDecidable(status: CorrectionStatus | string): void {
  if (!isDecidable(status)) {
    throw new ServiceError("already_decided", "This request has already been decided", 409);
  }
}

export function decisionStatusFor(approve: boolean): CorrectionStatus {
  return approve ? "APPROVED" : "REJECTED";
}

/**
 * Validate a decision payload: rejections must carry the reason the requester
 * will see; notes on either outcome are capped for the record.
 */
export function validateDecision(decision: { approve: boolean; note?: string }): { approve: boolean; note: string } {
  const note = String(decision.note ?? "").trim();
  if (!decision.approve && note.length < 5) {
    throw new ServiceError("validation_error", "Record a reason for the rejection (at least 5 characters)", 422);
  }
  if (note.length > 500) {
    throw new ServiceError("validation_error", "The note is too long (500 characters max)", 422);
  }
  return { approve: decision.approve, note };
}

// ── Server plumbing ────────────────────────────────────────────────────────

type Db = Prisma.TransactionClient | typeof prisma;

/** Where admins review requests — the notification link targets this section. */
export const CORRECTIONS_SECTION_ID = "corrections";
export const CORRECTIONS_REVIEW_PATH = `/admin/data#${CORRECTIONS_SECTION_ID}`;

function requireCapability(actor: User, capability: "corrections.request" | "corrections.manage"): void {
  if (!can(actor.role, capability)) {
    throw new ServiceError(
      "forbidden",
      capability === "corrections.request"
        ? "Not permitted to request corrections"
        : "Not permitted to review corrections",
      403,
    );
  }
}

type CorrectionTarget = {
  /** Canonical id stored on the request and used when applying the decision. */
  recordId: string;
  /** Human label for notifications and the audit trail. */
  label: string;
  /** Current stored value of the field (null when unset). */
  currentValue: string | null;
};

function studentProfileFieldValue(
  field: string,
  profile: { program: string; semester: number | null; batch: string | null; section: string | null },
): string | null {
  switch (field) {
    case "program":
      return profile.program;
    case "semester":
      return profile.semester === null ? null : String(profile.semester);
    case "batch":
      return profile.batch;
    case "section":
      return profile.section;
    default:
      return null;
  }
}

/** Resolve the record being corrected and capture its CURRENT value server-side. */
async function loadTarget(db: Db, entityType: CorrectionEntityType, recordId: string, field: string): Promise<CorrectionTarget> {
  if (entityType === "StudentProfile") {
    const profile = await db.studentProfile.findFirst({
      where: { OR: [{ id: recordId }, { userId: recordId }] },
      include: { user: { select: { id: true, name: true, registrationNo: true, role: true } } },
    });
    if (!profile || profile.user.role !== "STUDENT") {
      throw new ServiceError("not_found", "Student record not found", 404);
    }
    return {
      recordId: profile.userId,
      label: `${profile.user.name} (${profile.user.registrationNo ?? profile.user.id})`,
      currentValue: studentProfileFieldValue(field, profile),
    };
  }

  if (entityType === "User") {
    const user = await db.user.findUnique({
      where: { id: recordId },
      select: { id: true, name: true, registrationNo: true },
    });
    if (!user) throw new ServiceError("not_found", "Account not found", 404);
    return {
      recordId: user.id,
      label: `${user.name} (${user.registrationNo ?? user.id})`,
      currentValue: field === "name" ? user.name : user.registrationNo,
    };
  }

  const enrollment = await db.enrollment.findUnique({
    where: { id: recordId },
    include: {
      student: { select: { name: true, registrationNo: true } },
      class: { select: { courseCode: true, section: true } },
    },
  });
  if (!enrollment) throw new ServiceError("not_found", "Enrollment not found", 404);
  return {
    recordId: enrollment.id,
    label: `${enrollment.student.name} — ${enrollment.class.courseCode} section ${enrollment.class.section}`,
    currentValue: enrollment.status,
  };
}

/** Write the approved value onto the real record (inside the deciding transaction). */
async function applyCorrection(db: Db, entityType: CorrectionEntityType, recordId: string, field: string, newValue: string): Promise<void> {
  if (entityType === "StudentProfile") {
    const data: Prisma.StudentProfileUpdateInput =
      field === "program"
        ? { program: newValue }
        : field === "semester"
          ? { semester: Number.parseInt(newValue, 10) }
          : field === "batch"
            ? { batch: newValue }
            : { section: newValue };
    await db.studentProfile.update({ where: { userId: recordId }, data });
    return;
  }
  if (entityType === "User") {
    const data: Prisma.UserUpdateInput = field === "name" ? { name: newValue } : { registrationNo: newValue };
    await db.user.update({ where: { id: recordId }, data });
    return;
  }
  await db.enrollment.update({ where: { id: recordId }, data: { status: newValue } });
}

function requesterLink(entityType: CorrectionEntityType, recordId: string): string {
  if (entityType === "StudentProfile") return `/faculty/students/${recordId}`;
  if (entityType === "User") return "/profile";
  return "/faculty/students";
}

export type CorrectionRequestListItem = {
  id: string;
  entityType: CorrectionEntityType;
  recordId: string;
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
  status: CorrectionStatus;
  decisionNote: string | null;
  requestedByName: string;
  requestedByEmail: string;
  handledByName: string | null;
  handledAt: Date | null;
  createdAt: Date;
  /** Human description of the corrected record (null when it no longer exists). */
  recordLabel: string | null;
};

type RequestWithPeople = {
  id: string;
  entityType: string;
  recordId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
  status: CorrectionStatus;
  decisionNote: string | null;
  handledAt: Date | null;
  createdAt: Date;
  requestedBy: { name: string; email: string };
  handledBy: { name: string } | null;
};

const REQUEST_INCLUDE = {
  requestedBy: { select: { name: true, email: true } },
  handledBy: { select: { name: true } },
} as const;

const labelKey = (entityType: string, recordId: string) => `${entityType}:${recordId}`;

/** Batch-resolve human labels for the records referenced by a page of requests. */
async function resolveRecordLabels(rows: { entityType: string; recordId: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const userIds = rows
    .filter((r) => r.entityType === "StudentProfile" || r.entityType === "User")
    .map((r) => r.recordId);
  const enrollmentIds = rows.filter((r) => r.entityType === "Enrollment").map((r) => r.recordId);

  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, registrationNo: true },
    });
    for (const u of users) {
      const label = `${u.name} (${u.registrationNo ?? "—"})`;
      out.set(labelKey("StudentProfile", u.id), label);
      out.set(labelKey("User", u.id), label);
    }
  }
  if (enrollmentIds.length > 0) {
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds } },
      include: {
        student: { select: { name: true, registrationNo: true } },
        class: { select: { courseCode: true, section: true } },
      },
    });
    for (const e of enrollments) {
      out.set(
        labelKey("Enrollment", e.id),
        `${e.student.name} (${e.student.registrationNo ?? "—"}) — ${e.class.courseCode} section ${e.class.section}`,
      );
    }
  }
  return out;
}

function toListItem(row: RequestWithPeople, labels: Map<string, string>): CorrectionRequestListItem {
  const entityType = isCorrectionEntityType(row.entityType) ? row.entityType : "User";
  return {
    id: row.id,
    entityType,
    recordId: row.recordId,
    field: row.field,
    fieldLabel: fieldLabel(row.field),
    oldValue: row.oldValue,
    newValue: row.newValue,
    reason: row.reason,
    status: row.status,
    decisionNote: row.decisionNote,
    requestedByName: row.requestedBy.name,
    requestedByEmail: row.requestedBy.email,
    handledByName: row.handledBy?.name ?? null,
    handledAt: row.handledAt,
    createdAt: row.createdAt,
    recordLabel: labels.get(labelKey(row.entityType, row.recordId)) ?? null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a PENDING correction request. The current value is read from the
 * database (any client-supplied oldValue is ignored), no-ops and duplicate
 * in-flight requests for the same field + record are refused, and every
 * administrator is notified with a link to the review section.
 */
export async function createCorrectionRequest(actor: User, input: CorrectionRequestInput) {
  requireCapability(actor, "corrections.request");
  const validated = validateCorrectionRequest(input);

  const target = await loadTarget(prisma, validated.entityType, validated.recordId, validated.field);

  if (isNoOp(target.currentValue, validated.newValue)) {
    throw new ServiceError("no_changes", "The record already holds this value — nothing to correct", 400);
  }

  const duplicate = await prisma.dataCorrectionRequest.findFirst({
    where: {
      entityType: validated.entityType,
      recordId: target.recordId,
      field: validated.field,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ServiceError("duplicate", "A correction request for this field is already awaiting review", 409);
  }

  const request = await prisma.dataCorrectionRequest.create({
    data: {
      requestedById: actor.id,
      entityType: validated.entityType,
      recordId: target.recordId,
      field: validated.field,
      oldValue: target.currentValue,
      newValue: validated.newValue,
      reason: validated.reason,
      status: "PENDING",
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: "corrections.request",
    entity: "DataCorrectionRequest",
    entityId: request.id,
    summary: `Requested ${validated.entityType} correction for ${target.label}: ${fieldLabel(validated.field)} “${target.currentValue ?? "—"}” → “${validated.newValue}”`,
    meta: {
      entityType: validated.entityType,
      recordId: target.recordId,
      field: validated.field,
      oldValue: target.currentValue,
      newValue: validated.newValue,
      reason: validated.reason,
    },
  });

  // Best-effort: the request exists even if the notification fan-out fails.
  try {
    await notifyRole("ADMIN", {
      type: "SYSTEM",
      title: "Data correction request awaiting review",
      body: `${actor.name} requests a ${fieldLabel(validated.field)} change on ${target.label}: “${target.currentValue ?? "—"}” → “${validated.newValue}”. Reason: ${validated.reason}`,
      link: CORRECTIONS_REVIEW_PATH,
    });
  } catch (error) {
    console.error("correction request notify failed:", error);
  }

  return request;
}

/** Admin review list. `status: "DECIDED"` selects approved + rejected. */
export async function listCorrectionRequests(
  actor: User,
  opts?: { status?: CorrectionStatus | "DECIDED"; take?: number },
): Promise<CorrectionRequestListItem[]> {
  requireCapability(actor, "corrections.manage");

  const status = opts?.status;
  const where: Prisma.DataCorrectionRequestWhereInput =
    status === undefined
      ? {}
      : status === "DECIDED"
        ? { status: { in: ["APPROVED", "REJECTED"] } }
        : { status };

  const rows = await prisma.dataCorrectionRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.take ?? 50, 200),
    include: REQUEST_INCLUDE,
  });
  const labels = await resolveRecordLabels(rows);
  return rows.map((row) => toListItem(row, labels));
}

/** The requester's own recent requests (optionally for one record only). */
export async function listMyCorrectionRequests(
  actor: User,
  opts?: { recordId?: string; take?: number },
): Promise<CorrectionRequestListItem[]> {
  if (!can(actor.role, "corrections.request")) {
    throw new ServiceError("forbidden", "Not permitted to request corrections", 403);
  }

  const rows = await prisma.dataCorrectionRequest.findMany({
    where: { requestedById: actor.id, ...(opts?.recordId ? { recordId: opts.recordId } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.take ?? 10, 50),
    include: REQUEST_INCLUDE,
  });
  const labels = await resolveRecordLabels(rows);
  return rows.map((row) => toListItem(row, labels));
}

/**
 * Approve (apply + close) or reject (close with a reason) one request.
 * Transactional: status/handledBy/handledAt/decisionNote, the record update
 * and the requester notification commit together; the audit entry follows.
 * Already-decided requests are a 409 — refresh and look again.
 */
export async function decideCorrection(
  actor: User,
  requestId: string,
  decision: { approve: boolean; note?: string },
): Promise<CorrectionRequestListItem> {
  requireCapability(actor, "corrections.manage");
  const { approve, note } = validateDecision(decision);

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.dataCorrectionRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new ServiceError("not_found", "Correction request not found", 404);
    assertDecidable(request.status);
    if (!isCorrectionEntityType(request.entityType) || !isAllowedField(request.entityType, request.field)) {
      throw new ServiceError("validation_error", "This request references a field that cannot be corrected", 422);
    }
    const entityType = request.entityType;

    const closed = await tx.dataCorrectionRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: {
        status: decisionStatusFor(approve),
        handledById: actor.id,
        handledAt: new Date(),
        decisionNote: note || null,
      },
    });
    if (closed.count === 0) {
      throw new ServiceError("already_decided", "This request has already been decided", 409);
    }

    if (approve) {
      // Re-read inside the transaction: a record deleted since the request was
      // filed rolls the whole decision back (the request stays PENDING).
      await loadTarget(tx, entityType, request.recordId, request.field);
      await applyCorrection(tx, entityType, request.recordId, request.field, request.newValue);
    }

    await notifyUser(
      request.requestedById,
      {
        type: "SYSTEM",
        title: approve ? "Your correction request was approved" : "Your correction request was rejected",
        body: approve
          ? `${fieldLabel(request.field)} changed from “${request.oldValue ?? "—"}” to “${request.newValue}”.`
          : `Your request to change ${fieldLabel(request.field)} to “${request.newValue}” was rejected. Reason: ${note}`,
        link: requesterLink(entityType, request.recordId),
      },
      tx,
    );

    return tx.dataCorrectionRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: REQUEST_INCLUDE,
    });
  });

  await recordAudit({
    actorId: actor.id,
    action: approve ? "corrections.apply" : "corrections.reject",
    entity: "DataCorrectionRequest",
    entityId: requestId,
    summary: approve
      ? `${actor.name} approved a ${updated.entityType} correction: ${fieldLabel(updated.field)} “${updated.oldValue ?? "—"}” → “${updated.newValue}”`
      : `${actor.name} rejected a ${updated.entityType} correction: ${fieldLabel(updated.field)} → “${updated.newValue}”${note ? ` — ${note}` : ""}`,
    meta: {
      entityType: updated.entityType,
      recordId: updated.recordId,
      field: updated.field,
      oldValue: updated.oldValue,
      newValue: updated.newValue,
      approve,
      note: note || null,
    },
  });

  const labels = await resolveRecordLabels([updated]);
  return toListItem(updated, labels);
}
