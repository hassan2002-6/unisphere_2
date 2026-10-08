import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { can, type Capability, type Role } from "@/lib/rbac";

/**
 * Security suite (plan M6 §8):
 *  1. the RBAC matrix is asserted exhaustively, and
 *  2. every portal page, server action and API route is statically verified to
 *     gate on requireUser/requireCapability (server-side authorization).
 */

const ROLES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"];

const CAPABILITIES: Capability[] = [
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

/** The plan §8.1 matrix, restated independently of the implementation. */
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

describe("RBAC matrix", () => {
  for (const role of ROLES) {
    for (const cap of CAPABILITIES) {
      const expected = EXPECTED[role].includes(cap);
      it(`${role} ${expected ? "can" : "cannot"} "${cap}"`, () => {
        expect(can(role, cap)).toBe(expected);
      });
    }
  }

  it("mentors cannot decide FYP applications or manage inventory", () => {
    expect(can("MENTOR", "fyp.decide")).toBe(false);
    expect(can("MENTOR", "inventory.manage")).toBe(false);
    expect(can("MENTOR", "reports.view")).toBe(false);
  });

  it("students cannot review forms, broadcast, or approve mentors", () => {
    expect(can("STUDENT", "forms.review")).toBe(false);
    expect(can("STUDENT", "broadcast")).toBe(false);
    expect(can("STUDENT", "mentors.approve")).toBe(false);
  });
});

/* ---------- static guard scan ---------- */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const PORTAL_DIR = join(process.cwd(), "src", "app", "(portal)");
const API_DIR = join(process.cwd(), "src", "app", "api");
const GUARD = /require(User|Capability)\s*\(/;

describe("server-side authorization is everywhere", () => {
  it("every portal page calls requireUser/requireCapability", () => {
    const pages = walk(PORTAL_DIR).filter((f) => f.endsWith(`${join("", "page.tsx")}`));
    expect(pages.length).toBeGreaterThanOrEqual(30);
    const unguarded = pages.filter((f) => !GUARD.test(readFileSync(f, "utf8")));
    expect(unguarded).toEqual([]);
  });

  it("every portal server action calls requireUser/requireCapability", () => {
    const actions = walk(PORTAL_DIR).filter((f) => f.endsWith("actions.ts"));
    expect(actions.length).toBeGreaterThanOrEqual(6);
    const unguarded = actions.filter((f) => !GUARD.test(readFileSync(f, "utf8")));
    expect(unguarded).toEqual([]);
  });

  it("every API route is guarded or explicitly public", () => {
    const PUBLIC = ["health", "webhooks"]; // health probe + svix-verified webhook
    const routes = walk(API_DIR).filter((f) => f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThanOrEqual(3);
    const unguarded = routes.filter((f) => {
      const rel = f.replace(API_DIR, "");
      if (PUBLIC.some((p) => rel.includes(p))) return false;
      return !GUARD.test(readFileSync(f, "utf8"));
    });
    expect(unguarded).toEqual([]);
  });
});
