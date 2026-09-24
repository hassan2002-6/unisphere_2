import { describe, expect, it } from "vitest";
import { buildFormSchema, formFieldsSchema } from "@/lib/validation";

const spec = [
  { name: "courseCode", label: "Course code", type: "text" as const, required: true },
  { name: "reason", label: "Reason", type: "textarea" as const, required: true },
  { name: "type", label: "Type", type: "select" as const, required: true, options: ["Official", "Unofficial"] },
  { name: "copies", label: "Copies", type: "number" as const, required: false },
  { name: "urgent", label: "Urgent?", type: "checkbox" as const, required: false },
];

describe("form field spec validation", () => {
  it("accepts a valid template spec", () => {
    expect(formFieldsSchema.safeParse(spec).success).toBe(true);
  });
  it("rejects bad field names and unknown types", () => {
    expect(formFieldsSchema.safeParse([{ name: "1bad", label: "x", type: "text" }]).success).toBe(false);
    expect(formFieldsSchema.safeParse([{ name: "ok", label: "x", type: "email" }]).success).toBe(false);
  });
});

describe("buildFormSchema()", () => {
  const schema = buildFormSchema(spec);

  it("accepts a valid submission", () => {
    const result = schema.safeParse({
      courseCode: "CS-301",
      reason: "Schedule clash with my elective",
      type: "Official",
      copies: "2",
      urgent: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = schema.safeParse({ type: "Official" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("courseCode");
      expect(paths).toContain("reason");
    }
  });

  it("rejects select values outside the options", () => {
    const result = schema.safeParse({ courseCode: "X", reason: "12345", type: "Certified" });
    expect(result.success).toBe(false);
  });

  it("rejects overly short textarea content", () => {
    const result = schema.safeParse({ courseCode: "X", reason: "no", type: "Official" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra fields (strict)", () => {
    const result = schema.safeParse({
      courseCode: "X",
      reason: "valid reason here",
      type: "Official",
      evil: "payload",
    });
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings and validates dates when present", () => {
    const withDate = buildFormSchema([
      { name: "date", label: "Date", type: "date", required: true },
      { name: "count", label: "Count", type: "number", required: true },
    ]);
    expect(withDate.safeParse({ date: "2026-12-01", count: "3" }).success).toBe(true);
    expect(withDate.safeParse({ date: "01-12-2026", count: "3" }).success).toBe(false);
    expect(withDate.safeParse({ date: "2026-12-01", count: "abc" }).success).toBe(false);
  });
});
