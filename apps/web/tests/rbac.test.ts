import { describe, expect, it } from "vitest";
import { can, ROLE_LABELS, type Capability, type Role } from "@/lib/rbac";
import { NAV_BY_ROLE } from "@/lib/nav";

/**
 * RBAC matrix tests — plan §8.1, one positive + one negative per row.
 * Authorization must NEVER be inferred from the client; these tests pin the
 * server-side matrix so a regression fails CI.
 */

const ALL_ROLES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"];

const EXPECTED: Record<Role, Capability[]> = {
  STUDENT: [
    "forms.submit",
    "complaints.submit",
    "fyp.submit",
    "resources.request",
    "internships.apply",
    "mentorship.request",
    "chat.use",
    "messages.send",
  ],
  FACULTY: [
    "forms.submit",
    "forms.review",
    "complaints.manage",
    "attendance.manage",
    "marks.manage",
    "students.search",
    "messages.send",
    "reports.view",
  ],
  COORDINATOR: [
    "forms.submit",
    "forms.review",
    "complaints.manage",
    "internships.post",
    "broadcast",
    "clashes.view",
    "clashes.manage",
    "timetable.manage",
    "students.search",
    "messages.send",
    "reports.view",
    "audit.view",
  ],
  FYP_HEAD: [
    "forms.review",
    "fyp.decide",
    "resources.manage",
    "inventory.manage",
    "internships.post",
    "mentors.approve",
    "broadcast",
    "reports.view",
    "students.search",
    "messages.send",
    "audit.view",
  ],
  MENTOR: ["mentor.serve", "messages.send"],
  ADMIN: [
    "forms.submit",
    "forms.review",
    "complaints.manage",
    "fyp.decide",
    "resources.manage",
    "inventory.manage",
    "internships.post",
    "mentors.approve",
    "broadcast",
    "reports.view",
    "clashes.view",
    "clashes.manage",
    "timetable.manage",
    "attendance.manage",
    "marks.manage",
    "students.search",
    "messages.send",
    "audit.view",
    "users.manage",
  ],
};

const ALL_CAPS: Capability[] = [
  "forms.submit",
  "complaints.submit",
  "fyp.submit",
  "resources.request",
  "internships.apply",
  "mentorship.request",
  "chat.use",
  "forms.review",
  "complaints.manage",
  "fyp.decide",
  "resources.manage",
  "inventory.manage",
  "internships.post",
  "mentors.approve",
  "broadcast",
  "reports.view",
  "mentor.serve",
  "clashes.view",
  "clashes.manage",
  "timetable.manage",
  "attendance.manage",
  "marks.manage",
  "students.search",
  "messages.send",
  "audit.view",
  "users.manage",
];

describe("RBAC matrix (§8.1)", () => {
  for (const role of ALL_ROLES) {
    describe(role, () => {
      const allowed = new Set(EXPECTED[role]);

      for (const cap of ALL_CAPS) {
        const want = allowed.has(cap);
        it(`${want ? "allows" : "denies"} ${cap}`, () => {
          expect(can(role, cap)).toBe(want);
        });
      }
    });
  }

  it("has a label for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

describe("nav map", () => {
  it("has sections with items for every role", () => {
    for (const role of ALL_ROLES) {
      const sections = NAV_BY_ROLE[role];
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.items.length).toBeGreaterThan(0);
        for (const item of section.items) {
          expect(item.href.startsWith("/")).toBe(true);
        }
      }
    }
  });

  it("keeps mentor-only routes out of the student nav", () => {
    const studentHrefs = NAV_BY_ROLE.STUDENT.flatMap((s) => s.items.map((i) => i.href));
    expect(studentHrefs).not.toContain("/mentor");
    expect(studentHrefs).not.toContain("/admin/fyp");
  });
});
