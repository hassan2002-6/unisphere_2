import { describe, expect, it } from "vitest";
import { parseTemplateFields } from "@/server/services/forms-admin";

/**
 * Forms Manager (spec §11): the compact field description the administrator
 * types must turn into well-formed form fields — and refuse nonsense instead
 * of silently saving a broken template.
 */
describe("forms manager — compact field parser", () => {
  it("parses `Label | type` lines into named fields", () => {
    const fields = parseTemplateFields("Reason | textarea\nFrom date | date");
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ name: "reason", label: "Reason", type: "textarea", required: true });
    expect(fields[1]).toMatchObject({ name: "from_date", type: "date", required: true });
  });

  it("defaults the type to text and honours the optional flag", () => {
    const fields = parseTemplateFields("Guardian contact | text | optional\nPurpose");
    expect(fields[0]).toMatchObject({ label: "Guardian contact", type: "text", required: false });
    expect(fields[1]).toMatchObject({ label: "Purpose", type: "text", required: true });
  });

  it("parses select options from the fourth column", () => {
    const fields = parseTemplateFields("Action | select | required | Add, Drop");
    expect(fields[0].type).toBe("select");
    expect(fields[0].options).toEqual(["Add", "Drop"]);
  });

  it("refuses selects without options, unknown types and empty input", () => {
    expect(() => parseTemplateFields("Action | select")).toThrow(/needs options/);
    expect(() => parseTemplateFields("Reason | wizardry")).toThrow(/Unknown field type/);
    expect(() => parseTemplateFields("   \n  ")).toThrow(/at least one field/);
  });

  it("sanitises labels into safe field names", () => {
    const fields = parseTemplateFields("Student registration no. (CNIC) | text");
    expect(fields[0].name).toMatch(/^[a-z0-9_]+$/);
    expect(fields[0].name).toBe("student_registration_no_cnic");
  });
});
