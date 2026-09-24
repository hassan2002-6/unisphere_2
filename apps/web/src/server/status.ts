/**
 * Status machines (plan §6.2) — legal transitions enforced in services and
 * unit-tested. Services call `canTransition`/`assertTransition` before every
 * status write; the DB stores the result, it never decides.
 */

export type MachineKey =
  | "form"
  | "complaint"
  | "fyp"
  | "resourceRequest"
  | "allocation"
  | "mentorshipRequest"
  | "mentorshipSession"
  | "internshipApplication";

export const MACHINES: Record<MachineKey, Record<string, readonly string[]>> = {
  // SUBMITTED → UNDER_REVIEW → {APPROVED, REJECTED}; SUBMITTED → WITHDRAWN (submitter only)
  form: {
    SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
    UNDER_REVIEW: ["APPROVED", "REJECTED"],
    APPROVED: [],
    REJECTED: [],
    WITHDRAWN: [],
  },
  // OPEN → IN_REVIEW → {RESOLVED, CLOSED}; RESOLVED → CLOSED
  complaint: {
    OPEN: ["IN_REVIEW"],
    IN_REVIEW: ["RESOLVED", "CLOSED"],
    RESOLVED: ["CLOSED"],
    CLOSED: [],
  },
  // PENDING → {APPROVED, REJECTED}
  fyp: {
    PENDING: ["APPROVED", "REJECTED"],
    APPROVED: [],
    REJECTED: [],
  },
  // PENDING → RECOMMENDED → ALLOCATED | REJECTED; PENDING/RECOMMENDED → CANCELLED (owner)
  resourceRequest: {
    PENDING: ["RECOMMENDED", "REJECTED", "CANCELLED"],
    RECOMMENDED: ["ALLOCATED", "REJECTED", "CANCELLED"],
    ALLOCATED: [],
    REJECTED: [],
    CANCELLED: [],
  },
  // ACTIVE → {COMPLETED, REVOKED}
  allocation: {
    ACTIVE: ["COMPLETED", "REVOKED"],
    COMPLETED: [],
    REVOKED: [],
  },
  // PENDING → {ACCEPTED, DECLINED, CANCELLED}; ACCEPTED → COMPLETED (after a completed session)
  mentorshipRequest: {
    PENDING: ["ACCEPTED", "DECLINED", "CANCELLED"],
    ACCEPTED: ["COMPLETED"],
    DECLINED: [],
    CANCELLED: [],
    COMPLETED: [],
  },
  // PROPOSED → CONFIRMED → COMPLETED; PROPOSED → CANCELLED
  mentorshipSession: {
    PROPOSED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  },
  // APPLIED → SHORTLISTED → {ACCEPTED, REJECTED}; APPLIED → REJECTED
  internshipApplication: {
    APPLIED: ["SHORTLISTED", "REJECTED"],
    SHORTLISTED: ["ACCEPTED", "REJECTED"],
    ACCEPTED: [],
    REJECTED: [],
  },
};

export function canTransition(machine: MachineKey, from: string, to: string): boolean {
  return (MACHINES[machine][from] ?? []).includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(machine: MachineKey, from: string, to: string) {
    super(`Illegal ${machine} transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertTransition(machine: MachineKey, from: string, to: string): void {
  if (!canTransition(machine, from, to)) {
    throw new IllegalTransitionError(machine, from, to);
  }
}
