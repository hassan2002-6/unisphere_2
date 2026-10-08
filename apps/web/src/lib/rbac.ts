import type { Role } from "@unisphere/db";

export type { Role };

/**
 * Role → capability matrix — plan §8.1. Enforced server-side only;
 * the UI may hide things, but authorization decisions always call `can()`
 * against the DB role (never the client).
 */
export type Capability =
  | "forms.submit"
  | "complaints.submit"
  | "fyp.submit"
  | "resources.request"
  | "internships.apply"
  | "mentorship.request"
  | "chat.use"
  | "forms.review"
  | "complaints.manage"
  | "fyp.decide"
  | "resources.manage"
  | "inventory.manage"
  | "internships.post"
  | "mentors.approve"
  | "broadcast"
  | "reports.view"
  | "mentor.serve"
  | "clashes.view"
  | "clashes.manage"
  | "attendance.manage"
  | "marks.manage"
  | "students.search"
  | "messages.send"
  | "audit.view"
  | "users.manage";

const MATRIX: Record<Role, readonly Capability[]> = {
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
    "attendance.manage",
    "marks.manage",
    "students.search",
    "messages.send",
    "audit.view",
    "users.manage",
  ],
} as const;

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  COORDINATOR: "Coordinator",
  FYP_HEAD: "FYP Head",
  MENTOR: "Mentor",
  ADMIN: "Administrator",
};
