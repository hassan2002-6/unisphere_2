import { describe, expect, it } from "vitest";
import {
  COMPLAINT_STATUSES,
  INBOX_VIEWS,
  RECIPIENT_ROLES,
  canActOnComplaint,
  canManageComplaint,
  isRecipientRole,
  mapInboxView,
  recipientCanAct,
  recipientRoleOf,
  validateRecipientSelection,
} from "@/lib/complaint-policy";
import type { Role } from "@/lib/rbac";

/**
 * Multi-recipient complaints (goal §8): the pure rules that both the services
 * and the client pickers run — recipient validation, the CC read-only
 * permission predicate, and the inbox view → status mapping. No DB needed.
 */

const who = (id: string, role: Role) => ({ id, role });
const caseFile = (over: Partial<{ assignedToId: string | null; category: string; submittedById: string }> = {}) => ({
  assignedToId: null,
  category: "IT",
  submittedById: "student-1",
  ...over,
});

describe("validateRecipientSelection (§8)", () => {
  it("accepts a To-only selection and cleans the arrays", () => {
    const result = validateRecipientSelection({ toIds: ["u1", "u2"], ccIds: [] });
    expect(result).toEqual({ ok: true, toIds: ["u1", "u2"], ccIds: [] });
  });

  it("accepts To + CC and trims blank ids", () => {
    const result = validateRecipientSelection({ toIds: [" u1 "], ccIds: ["", "  ", "u2"] });
    expect(result).toEqual({ ok: true, toIds: ["u1"], ccIds: ["u2"] });
  });

  it("rejects a selection with no To recipient", () => {
    const result = validateRecipientSelection({ toIds: [], ccIds: ["u1"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least one To/i);
  });

  it("rejects a blank-only To list (form noise can't sneaks past)", () => {
    const result = validateRecipientSelection({ toIds: ["   ", null, undefined], ccIds: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects the same person being both a To and a CC recipient", () => {
    const result = validateRecipientSelection({ toIds: ["u1"], ccIds: ["u1"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/both/i);
  });

  it("rejects duplicates inside one list", () => {
    expect(validateRecipientSelection({ toIds: ["u1", "u1"], ccIds: [] }).ok).toBe(false);
    expect(validateRecipientSelection({ toIds: ["u1"], ccIds: ["u2", "u2"] }).ok).toBe(false);
  });

  it("treats an entirely empty selection as invalid (no recipients picked)", () => {
    expect(validateRecipientSelection({}).ok).toBe(false);
    expect(validateRecipientSelection({ toIds: null, ccIds: null }).ok).toBe(false);
  });
});

describe("recipient role whitelist", () => {
  it("allows exactly faculty, coordinators, the FYP head and admins", () => {
    expect([...RECIPIENT_ROLES].sort()).toEqual(["ADMIN", "COORDINATOR", "FACULTY", "FYP_HEAD"]);
    for (const role of ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"]) {
      expect(isRecipientRole(role), role).toBe(true);
    }
  });

  it("never allows students, mentors or unknown values", () => {
    for (const role of ["STUDENT", "MENTOR", "faculty", "", "null", "ADMIN "]) {
      expect(isRecipientRole(role), role).toBe(false);
    }
  });
});

describe("CC read-only permission predicate", () => {
  const recipients = [
    { userId: "u-to", role: "TO" as const },
    { userId: "u-cc", role: "CC" as const },
  ];

  it("finds each user's recipient role (TO / CC / null)", () => {
    expect(recipientRoleOf("u-to", recipients)).toBe("TO");
    expect(recipientRoleOf("u-cc", recipients)).toBe("CC");
    expect(recipientRoleOf("stranger", recipients)).toBeNull();
  });

  it("To recipients may act; CC recipients and strangers may not (at recipient level)", () => {
    expect(recipientCanAct("u-to", recipients)).toBe(true);
    expect(recipientCanAct("u-cc", recipients)).toBe(false);
    expect(recipientCanAct("stranger", recipients)).toBe(false);
  });

  it("the assignee may act", () => {
    expect(canActOnComplaint(who("u1", "FACULTY"), caseFile({ assignedToId: "u1" }), recipients)).toBe(true);
  });

  it("a To recipient may act even without the global complaints.manage capability", () => {
    // FYP_HEAD has no complaints.manage in the RBAC matrix — the explicit To
    // grant is what authorises action.
    expect(canManageComplaint(who("u-to", "FYP_HEAD"), caseFile())).toBe(false);
    expect(canActOnComplaint(who("u-to", "FYP_HEAD"), caseFile(), recipients)).toBe(true);
  });

  it("a CC recipient with no desk powers is read-only", () => {
    expect(canActOnComplaint(who("u-cc", "FYP_HEAD"), caseFile(), recipients)).toBe(false);
    expect(canActOnComplaint(who("u-cc", "STUDENT"), caseFile(), recipients)).toBe(false);
  });

  it("CC never grants action rights, but it does not remove desk powers either", () => {
    expect(canActOnComplaint(who("u-cc", "COORDINATOR"), caseFile(), recipients)).toBe(true);
  });

  it("unrelated students and strangers cannot act", () => {
    expect(canActOnComplaint(who("student-2", "STUDENT"), caseFile(), recipients)).toBe(false);
    expect(canActOnComplaint(who("other-faculty", "FACULTY"), caseFile({ assignedToId: "u1" }), recipients)).toBe(false);
  });

  it("preserves the desk rules: coordinator/admin anywhere, faculty queue on unassigned faculty cases", () => {
    expect(canActOnComplaint(who("coord", "COORDINATOR"), caseFile(), [])).toBe(true);
    expect(canActOnComplaint(who("admin", "ADMIN"), caseFile({ assignedToId: "someone" }), [])).toBe(true);
    expect(canActOnComplaint(who("prof", "FACULTY"), caseFile({ category: "Faculty", assignedToId: null }), [])).toBe(true);
    expect(canActOnComplaint(who("prof", "FACULTY"), caseFile({ category: "Faculty", assignedToId: "other" }), [])).toBe(false);
  });
});

describe("inbox view → status mapping", () => {
  it("exposes exactly inbox/unread/pending/resolved/archived", () => {
    expect([...INBOX_VIEWS]).toEqual(["inbox", "unread", "pending", "resolved", "archived"]);
  });

  it("falls back to the full inbox for unknown views", () => {
    for (const view of [undefined, null, "", "NONSENSE", "INBOX"]) {
      const mapped = mapInboxView(view);
      expect(mapped.view).toBe("inbox");
      expect(mapped.statuses).toBeNull();
      expect(mapped.unreadOnly).toBe(false);
    }
  });

  it("unread filters on the recipient row, not on status", () => {
    const mapped = mapInboxView("unread");
    expect(mapped).toEqual({ view: "unread", statuses: null, unreadOnly: true });
  });

  it("pending covers everything still needing action", () => {
    expect(mapInboxView("pending").statuses).toEqual(["OPEN", "IN_REVIEW", "AWAITING_INFO"]);
  });

  it("resolved and archived map onto RESOLVED and CLOSED", () => {
    expect(mapInboxView("resolved").statuses).toEqual(["RESOLVED"]);
    expect(mapInboxView("archived").statuses).toEqual(["CLOSED"]);
  });

  it("together the status views cover every complaint status exactly once", () => {
    const covered = [
      ...(mapInboxView("pending").statuses ?? []),
      ...(mapInboxView("resolved").statuses ?? []),
      ...(mapInboxView("archived").statuses ?? []),
    ];
    expect([...covered].sort()).toEqual([...COMPLAINT_STATUSES].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });
});
