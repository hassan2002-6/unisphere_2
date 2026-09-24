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
  | "clashes.view";

const MATRIX: Record<Role, readonly Capability[]> = {
  STUDENT: [
    "forms.submit",
    "complaints.submit",
    "fyp.submit",
    "resources.request",
    "internships.apply",
    "mentorship.request",
    "chat.use",
  ],
  FACULTY: ["forms.submit", "forms.review", "complaints.manage"],
  COORDINATOR: ["forms.submit", "forms.review", "complaints.manage", "internships.post", "broadcast", "clashes.view"],
  FYP_HEAD: ["forms.review", "fyp.decide", "resources.manage", "inventory.manage", "internships.post", "mentors.approve", "broadcast", "reports.view"],
  MENTOR: ["mentor.serve"],
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
};
