import { describe, expect, it } from "vitest";
import { evaluateEligibility, missingPrerequisites } from "@/server/services/admit-cards";

/**
 * Admit-card eligibility predicate (spec §10 "required test": generation
 * blocked while a prerequisite is missing, allowed when satisfied).
 * Pure — fixtures in, outcomes out; no database is touched.
 */

const rule = { requiredFormKey: "faculty-form", requireEnrollment: true, feeClearanceEnabled: false };
const facts = (over: Partial<{ approvedFormKeys: string[]; enrollmentCount: number }> = {}) => ({
  approvedFormKeys: ["faculty-form"],
  enrollmentCount: 2,
  ...over,
});

describe("admit-card eligibility — pure predicate", () => {
  it("is eligible when the required form is approved and an enrollment exists", () => {
    const result = evaluateEligibility(rule, facts());
    expect(result.eligible).toBe(true);
    expect(result.checks.map((c) => c.key)).toEqual(["required_form", "enrollment"]);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    expect(missingPrerequisites(result.checks)).toEqual([]);
  });

  it("blocks when the required form has no APPROVED submission (missing form)", () => {
    const result = evaluateEligibility(rule, facts({ approvedFormKeys: ["some-other-form"] }));
    expect(result.eligible).toBe(false);
    const form = result.checks.find((c) => c.key === "required_form");
    expect(form).toMatchObject({ passed: false });
    expect(form?.detail).toContain("faculty-form");
    expect(form?.detail).toMatch(/No approved/);
    expect(missingPrerequisites(result.checks)).toHaveLength(1);
  });

  it("blocks when the student has no enrollment record", () => {
    const result = evaluateEligibility(rule, facts({ enrollmentCount: 0 }));
    expect(result.eligible).toBe(false);
    const enrollment = result.checks.find((c) => c.key === "enrollment");
    expect(enrollment).toMatchObject({ passed: false });
    expect(enrollment?.detail).toMatch(/coordination office/);
  });

  it("with every requirement disabled, nothing blocks eligibility", () => {
    const result = evaluateEligibility(
      { requiredFormKey: null, requireEnrollment: false, feeClearanceEnabled: false },
      { approvedFormKeys: [], enrollmentCount: 0 },
    );
    expect(result.eligible).toBe(true);
    expect(result.checks).toEqual([]);
  });

  it("fee clearance stays a soft, non-blocking note when enabled", () => {
    const result = evaluateEligibility({ ...rule, feeClearanceEnabled: true }, facts());
    expect(result.eligible).toBe(true);
    const fee = result.checks.find((c) => c.key === "fee_clearance");
    expect(fee).toMatchObject({ passed: true, soft: true });
    expect(fee?.detail).toMatch(/not tracked in the portal/);
    expect(missingPrerequisites(result.checks)).toEqual([]);
  });

  it("names exactly the outstanding hard prerequisites", () => {
    const missing = missingPrerequisites(
      evaluateEligibility(rule, facts({ approvedFormKeys: [], enrollmentCount: 0 })).checks,
    );
    expect(missing.map((c) => c.key)).toEqual(["required_form", "enrollment"]);
    expect(missing.every((c) => !c.passed && !c.soft)).toBe(true);
  });
});
