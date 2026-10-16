import { can, type Role } from "./rbac";

/**
 * Complaint recipient policy (goal §8) — one canonical complaint, many
 * recipients. These rules are deliberately pure (no Prisma, no Next runtime)
 * so the server services and the client pickers enforce the exact same
 * validation, and so they can be unit-tested directly.
 *
 * Terminology:
 *  - TO recipients: staff who handle the complaint and may act on it.
 *  - CC recipients: staff copied for visibility — read-only.
 */

/** Roles that may be chosen as a complaint recipient. */
export const RECIPIENT_ROLES = ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"] as const;

export function isRecipientRole(role: string): boolean {
  return (RECIPIENT_ROLES as readonly string[]).includes(role);
}

export type RecipientRole = "TO" | "CC";
export type RecipientLike = { userId: string; role: RecipientRole };

export type RecipientSelectionResult =
  | { ok: true; toIds: string[]; ccIds: string[] }
  | { ok: false; error: string };

/**
 * Pure To/CC selection checks: at least one To recipient, no duplicate person
 * within a list or across the two lists. Blank ids are dropped first so
 * form-input noise ("", "  ") can never masquerade as a selection.
 */
export function validateRecipientSelection(input: {
  toIds?: readonly (string | null | undefined)[] | null;
  ccIds?: readonly (string | null | undefined)[] | null;
}): RecipientSelectionResult {
  const clean = (ids?: readonly (string | null | undefined)[] | null): string[] =>
    (ids ?? [])
      .map((id) => (id == null ? "" : String(id).trim()))
      .filter((id) => id.length > 0);

  const toIds = clean(input.toIds);
  const ccIds = clean(input.ccIds);

  if (toIds.some((id, i) => toIds.indexOf(id) !== i)) {
    return { ok: false, error: "The same person can’t be added to To twice" };
  }
  if (ccIds.some((id, i) => ccIds.indexOf(id) !== i)) {
    return { ok: false, error: "The same person can’t be added to CC twice" };
  }
  if (toIds.some((id) => ccIds.includes(id))) {
    return { ok: false, error: "A person can’t be both a To recipient and a CC recipient" };
  }
  if (toIds.length === 0) {
    return { ok: false, error: "Pick at least one To recipient" };
  }
  return { ok: true, toIds, ccIds };
}

/** The user's recipient role on a complaint (TO / CC), or null when not a recipient. */
export function recipientRoleOf(userId: string, recipients: readonly RecipientLike[]): RecipientRole | null {
  return recipients.find((r) => r.userId === userId)?.role ?? null;
}

/** Recipient-level rule: a To recipient may act; a CC recipient is read-only. */
export function recipientCanAct(userId: string, recipients: readonly RecipientLike[]): boolean {
  return recipientRoleOf(userId, recipients) === "TO";
}

export type ComplaintForAccess = { assignedToId: string | null; category: string; submittedById: string };

/** Manager = assignee, coordinator, admin, or (unassigned faculty-category) faculty. */
export function canManageComplaint(user: { id: string; role: Role }, c: ComplaintForAccess): boolean {
  if (!can(user.role, "complaints.manage")) return false;
  if (user.role === "COORDINATOR" || user.role === "ADMIN") return true;
  if (c.assignedToId === user.id) return true;
  return user.role === "FACULTY" && c.category === "Faculty" && c.assignedToId === null;
}

/**
 * Who may act (respond / forward / resolve / escalate / note) on a complaint:
 * the assignee, a To recipient (staff picked explicitly — even when their role
 * has no global complaints.manage), or a desk manager. CC recipients are never
 * granted action rights by their recipient row.
 */
export function canActOnComplaint(
  user: { id: string; role: Role },
  c: ComplaintForAccess,
  recipients: readonly RecipientLike[],
): boolean {
  if (recipientCanAct(user.id, recipients)) return true;
  return canManageComplaint(user, c);
}

/** Every complaint status the inbox views can map onto. */
export const COMPLAINT_STATUSES = ["OPEN", "IN_REVIEW", "AWAITING_INFO", "RESOLVED", "CLOSED"] as const;
export type ComplaintStatusCode = (typeof COMPLAINT_STATUSES)[number];

export const INBOX_VIEWS = ["inbox", "unread", "pending", "resolved", "archived"] as const;
export type ComplaintInboxView = (typeof INBOX_VIEWS)[number];

export type InboxViewMapping = {
  view: ComplaintInboxView;
  /** Status filter for the query; null = every status. */
  statuses: readonly ComplaintStatusCode[] | null;
  /** Only complaints whose recipient row is still unread. */
  unreadOnly: boolean;
};

/** Inbox view → status mapping (pending = still needs action; archived = closed). */
export function mapInboxView(view?: string | null): InboxViewMapping {
  switch (view) {
    case "unread":
      return { view: "unread", statuses: null, unreadOnly: true };
    case "pending":
      return { view: "pending", statuses: ["OPEN", "IN_REVIEW", "AWAITING_INFO"], unreadOnly: false };
    case "resolved":
      return { view: "resolved", statuses: ["RESOLVED"], unreadOnly: false };
    case "archived":
      return { view: "archived", statuses: ["CLOSED"], unreadOnly: false };
    default:
      return { view: "inbox", statuses: null, unreadOnly: false };
  }
}
