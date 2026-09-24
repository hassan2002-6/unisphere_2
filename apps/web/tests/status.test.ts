import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, IllegalTransitionError, MACHINES } from "@/server/status";
import type { MachineKey } from "@/server/status";

describe("status machines (§6.2)", () => {
  it("form: legal path SUBMITTED → UNDER_REVIEW → APPROVED", () => {
    expect(canTransition("form", "SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("form", "UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("form", "UNDER_REVIEW", "REJECTED")).toBe(true);
  });
  it("form: SUBMITTED → WITHDRAWN legal; other skips illegal", () => {
    expect(canTransition("form", "SUBMITTED", "WITHDRAWN")).toBe(true);
    expect(canTransition("form", "SUBMITTED", "APPROVED")).toBe(false);
    expect(canTransition("form", "APPROVED", "WITHDRAWN")).toBe(false);
  });

  it("complaint: OPEN → IN_REVIEW → RESOLVED → CLOSED", () => {
    expect(canTransition("complaint", "OPEN", "IN_REVIEW")).toBe(true);
    expect(canTransition("complaint", "IN_REVIEW", "RESOLVED")).toBe(true);
    expect(canTransition("complaint", "RESOLVED", "CLOSED")).toBe(true);
    expect(canTransition("complaint", "OPEN", "RESOLVED")).toBe(false);
    expect(canTransition("complaint", "CLOSED", "OPEN")).toBe(false);
  });

  it("fyp: PENDING decides only once", () => {
    expect(canTransition("fyp", "PENDING", "APPROVED")).toBe(true);
    expect(canTransition("fyp", "APPROVED", "REJECTED")).toBe(false);
  });

  it("resource request: full chain and cancellations", () => {
    expect(canTransition("resourceRequest", "PENDING", "RECOMMENDED")).toBe(true);
    expect(canTransition("resourceRequest", "RECOMMENDED", "ALLOCATED")).toBe(true);
    expect(canTransition("resourceRequest", "PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("resourceRequest", "RECOMMENDED", "CANCELLED")).toBe(true);
    expect(canTransition("resourceRequest", "PENDING", "ALLOCATED")).toBe(false);
  });

  it("allocation: ACTIVE closes once", () => {
    expect(canTransition("allocation", "ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransition("allocation", "ACTIVE", "REVOKED")).toBe(true);
    expect(canTransition("allocation", "COMPLETED", "REVOKED")).toBe(false);
  });

  it("mentorship request: PENDING decides; ACCEPTED completes", () => {
    expect(canTransition("mentorshipRequest", "PENDING", "ACCEPTED")).toBe(true);
    expect(canTransition("mentorshipRequest", "PENDING", "DECLINED")).toBe(true);
    expect(canTransition("mentorshipRequest", "ACCEPTED", "COMPLETED")).toBe(true);
    expect(canTransition("mentorshipRequest", "COMPLETED", "CANCELLED")).toBe(false);
  });

  it("mentorship session: PROPOSED → CONFIRMED → COMPLETED", () => {
    expect(canTransition("mentorshipSession", "PROPOSED", "CONFIRMED")).toBe(true);
    expect(canTransition("mentorshipSession", "PROPOSED", "CANCELLED")).toBe(true);
    expect(canTransition("mentorshipSession", "CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransition("mentorshipSession", "COMPLETED", "CANCELLED")).toBe(false);
  });

  it("internship application: SHORTLIST required before ACCEPTED", () => {
    expect(canTransition("internshipApplication", "APPLIED", "REJECTED")).toBe(true);
    expect(canTransition("internshipApplication", "APPLIED", "SHORTLISTED")).toBe(true);
    expect(canTransition("internshipApplication", "SHORTLISTED", "ACCEPTED")).toBe(true);
    expect(canTransition("internshipApplication", "APPLIED", "ACCEPTED")).toBe(false);
  });

  it("every machine: terminal states have no outgoing transitions except closed chains", () => {
    for (const [machine, states] of Object.entries(MACHINES) as [MachineKey, Record<string, readonly string[]>][]) {
      for (const terminal of ["REJECTED", "WITHDRAWN", "CLOSED"]) {
        if (states[terminal]) {
          // CLOSED is terminal; REJECTED/WITHDRAWN are terminal in every machine.
          if (terminal === "CLOSED") continue;
          expect(states[terminal], `${machine}.${terminal} should be terminal`).toHaveLength(0);
        }
      }
    }
  });

  it("unknown from-state is rejected", () => {
    expect(canTransition("form", "NONSENSE", "APPROVED")).toBe(false);
  });

  it("assertTransition throws IllegalTransitionError with a clear message", () => {
    expect(() => assertTransition("form", "APPROVED", "REJECTED")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("form", "APPROVED", "REJECTED")).toThrow(
      "Illegal form transition: APPROVED → REJECTED",
    );
  });
});
