import { describe, expect, it } from "vitest";
import {
  CORRECTION_ENTITY_TYPES,
  CORRECTION_FIELD_WHITELIST,
  ENROLLMENT_STATUSES,
  assertDecidable,
  decisionStatusFor,
  fieldLabel,
  isAllowedField,
  isCorrectionEntityType,
  isDecidable,
  isNoOp,
  normalizeCorrectionValue,
  validateCorrectionRequest,
  validateDecision,
  type CorrectionEntityType,
} from "@/server/services/corrections";
import { ServiceError } from "@/server/services/forms";

/**
 * Data-correction requests (goal §6): the whitelist, the input validation and
 * the state-transition rules are all pure — no database here. The DB-bound
 * half (capture the current value, apply on approve, notify, audit) needs a
 * live database and is not covered in this suite.
 */

const validInput = {
  entityType: "StudentProfile",
  recordId: "stu_1",
  field: "section",
  newValue: "B",
  reason: "Moved to section B by the HOD",
};

describe("field whitelist", () => {
  it("contains exactly the real writable columns of each record type", () => {
    expect(CORRECTION_ENTITY_TYPES).toEqual(["StudentProfile", "User", "Enrollment"]);
    expect(CORRECTION_FIELD_WHITELIST.StudentProfile).toEqual(["program", "semester", "batch", "section"]);
    expect(CORRECTION_FIELD_WHITELIST.User).toEqual(["name", "registrationNo"]);
    expect(CORRECTION_FIELD_WHITELIST.Enrollment).toEqual(["status"]);
  });

  it("accepts every whitelisted field and refuses everything else", () => {
    for (const entityType of CORRECTION_ENTITY_TYPES) {
      for (const field of CORRECTION_FIELD_WHITELIST[entityType]) {
        expect(isAllowedField(entityType, field)).toBe(true);
      }
    }
    // Primary keys, relations, derived and sensitive columns are not correctable.
    expect(isAllowedField("StudentProfile", "id")).toBe(false);
    expect(isAllowedField("StudentProfile", "userId")).toBe(false);
    expect(isAllowedField("User", "role")).toBe(false);
    expect(isAllowedField("User", "clerkId")).toBe(false);
    expect(isAllowedField("User", "email")).toBe(false);
    expect(isAllowedField("User", "isActive")).toBe(false);
    expect(isAllowedField("Enrollment", "classId")).toBe(false);
    expect(isAllowedField("Enrollment", "studentId")).toBe(false);
    // Unknown record types are never allowed.
    expect(isAllowedField("CourseClass", "title")).toBe(false);
    expect(isAllowedField("", "section")).toBe(false);
    expect(isCorrectionEntityType("StudentProfile")).toBe(true);
    expect(isCorrectionEntityType("Student")).toBe(false);
  });

  it("exposes human labels for the corrected fields", () => {
    expect(fieldLabel("registrationNo")).toBe("Registration no");
    expect(fieldLabel("status")).toBe("Enrollment status");
    expect(fieldLabel("somethingElse")).toBe("somethingElse");
  });
});

describe("request validation", () => {
  it("normalises valid values and ignores the client-supplied oldValue", () => {
    expect(
      validateCorrectionRequest({
        ...validInput,
        field: "section",
        newValue: " b ",
        reason: "  Moved to section B by the HOD  ",
        oldValue: "FORGED",
      }),
    ).toEqual({
      entityType: "StudentProfile",
      recordId: "stu_1",
      field: "section",
      newValue: "B",
      reason: "Moved to section B by the HOD",
    });

    expect(normalizeCorrectionValue("StudentProfile", "program", " bscs ")).toBe("BSCS");
    expect(normalizeCorrectionValue("StudentProfile", "semester", "07")).toBe("7");
    expect(normalizeCorrectionValue("StudentProfile", "batch", " BSCS-2023 ")).toBe("BSCS-2023");
    expect(normalizeCorrectionValue("User", "registrationNo", "s22csc001")).toBe("S22CSC001");
    expect(normalizeCorrectionValue("Enrollment", "status", "dropped")).toBe("DROPPED");
    expect(normalizeCorrectionValue("Enrollment", "status", ENROLLMENT_STATUSES[0])).toBe("ACTIVE");
  });

  it("refuses unknown record types and non-whitelisted fields", () => {
    expect(() => validateCorrectionRequest({ ...validInput, entityType: "Student" })).toThrow(
      /Unsupported record type/,
    );
    expect(() => validateCorrectionRequest({ ...validInput, field: "cnic" })).toThrow(
      /is not a correctable field/,
    );
    expect(() => validateCorrectionRequest({ ...validInput, entityType: "Enrollment", field: "section" })).toThrow(
      /is not a correctable field/,
    );
  });

  it("refuses values that do not look like the field", () => {
    const reject = (entityType: CorrectionEntityType, field: string, newValue: string, pattern: RegExp) => {
      expect(() => normalizeCorrectionValue(entityType, field, newValue)).toThrow(pattern);
    };
    reject("StudentProfile", "program", "BSCS The Best", /short code/);
    reject("StudentProfile", "semester", "7.5", /whole number/);
    reject("StudentProfile", "semester", "0", /between 1 and 12/);
    reject("StudentProfile", "semester", "13", /between 1 and 12/);
    reject("StudentProfile", "batch", "BSCS 2023", /BSCS-2023/);
    reject("StudentProfile", "section", "ABCDE", /Section/);
    reject("User", "name", "Al", /at least 3 characters/);
    reject("User", "registrationNo", "12345", /S22CSC001/);
    reject("Enrollment", "status", "ARCHIVED", /must be one of ACTIVE, COMPLETED, DROPPED/);
    expect(() => normalizeCorrectionValue("StudentProfile", "section", "   ")).toThrow(/Enter the new value/);
    expect(() => normalizeCorrectionValue("User", "name", "x".repeat(201))).toThrow(/too long/);
  });

  it("requires a record id and a real reason", () => {
    expect(() => validateCorrectionRequest({ ...validInput, recordId: "  " })).toThrow(/Missing the record/);
    expect(() => validateCorrectionRequest({ ...validInput, reason: "fix" })).toThrow(/reason/);
    expect(() => validateCorrectionRequest({ ...validInput, reason: "x".repeat(501) })).toThrow(/too long/);
  });

  it("signals failures as 422 ServiceErrors", () => {
    try {
      validateCorrectionRequest({ ...validInput, field: "salary" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect((error as ServiceError).status).toBe(422);
      expect((error as ServiceError).code).toBe("validation_error");
    }
  });
});

describe("no-op detection", () => {
  it("treats an unchanged value as a no-op and a real change as a request", () => {
    expect(isNoOp("A", "A")).toBe(true);
    expect(isNoOp("BSCS", "BSCS")).toBe(true);
    expect(isNoOp("A", "B")).toBe(false);
    expect(isNoOp(null, "A")).toBe(false);
    expect(isNoOp("A", "")).toBe(false);
  });
});

describe("state transitions", () => {
  it("only PENDING requests can be decided", () => {
    expect(isDecidable("PENDING")).toBe(true);
    expect(isDecidable("APPROVED")).toBe(false);
    expect(isDecidable("REJECTED")).toBe(false);
    expect(() => assertDecidable("PENDING")).not.toThrow();
  });

  it("refuses to decide an already-decided request as a 409 conflict", () => {
    for (const status of ["APPROVED", "REJECTED"] as const) {
      try {
        assertDecidable(status);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).status).toBe(409);
        expect((error as ServiceError).code).toBe("already_decided");
      }
    }
  });

  it("maps the decision to the stored status", () => {
    expect(decisionStatusFor(true)).toBe("APPROVED");
    expect(decisionStatusFor(false)).toBe("REJECTED");
  });

  it("requires a written reason when rejecting, but not when approving", () => {
    expect(validateDecision({ approve: true })).toEqual({ approve: true, note: "" });
    expect(validateDecision({ approve: true, note: " looks right " })).toEqual({ approve: true, note: "looks right" });
    expect(validateDecision({ approve: false, note: "Wrong section — HOD confirmed" })).toEqual({
      approve: false,
      note: "Wrong section — HOD confirmed",
    });
    expect(() => validateDecision({ approve: false })).toThrow(/reason for the rejection/);
    expect(() => validateDecision({ approve: false, note: "no" })).toThrow(/reason for the rejection/);
    expect(() => validateDecision({ approve: true, note: "x".repeat(501) })).toThrow(/too long/);
  });
});
