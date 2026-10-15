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
  | "assignments.submit"
  | "chat.use"
  | "forms.review"
  | "complaints.manage"
  | "complaints.route"
  | "fyp.decide"
  | "resources.manage"
  | "inventory.manage"
  | "internships.post"
  | "broadcast"
  | "reports.view"
  | "clashes.view"
  | "clashes.manage"
  | "timetable.manage"
  | "attendance.manage"
  | "marks.manage"
  | "assignments.manage"
  | "students.search"
  | "messages.send"
  | "audit.view"
  | "users.manage"
  | "knowledge.manage"
  | "profiles.manage";

const MATRIX: Record<Role, readonly Capability[]> = {
  STUDENT: [
    "forms.submit",
    "complaints.submit",
    "fyp.submit",
    "resources.request",
    "internships.apply",
    "assignments.submit",
    "chat.use",
    "messages.send",
  ],
  FACULTY: [
    "forms.submit",
    "forms.review",
    "complaints.manage",
    "assignments.manage",
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
    "broadcast",
    "reports.view",
    "students.search",
    "messages.send",
    "audit.view",
  ],
  MENTOR: ["messages.send"],
  ADMIN: [
    "forms.submit",
    "forms.review",
    "complaints.manage",
    "complaints.route",
    "fyp.decide",
    "resources.manage",
    "inventory.manage",
    "internships.post",
    "broadcast",
    "reports.view",
    "clashes.view",
    "clashes.manage",
    "timetable.manage",
    "attendance.manage",
    "marks.manage",
    "assignments.manage",
    "students.search",
    "messages.send",
    "audit.view",
    "users.manage",
    "knowledge.manage",
    "profiles.manage",
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

/** Every capability a role holds — the "what you can do" list on /profile. */
export function capabilitiesFor(role: Role): readonly Capability[] {
  return MATRIX[role];
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "forms.submit": "Submit forms and requests",
  "complaints.submit": "File complaints",
  "fyp.submit": "Apply for an FYP",
  "resources.request": "Request GPU / lab resources",
  "internships.apply": "Apply to internships",
  "assignments.submit": "Submit coursework assignments",
  "chat.use": "Use the AI assistant",
  "forms.review": "Review form submissions",
  "complaints.manage": "Handle complaints",
  "complaints.route": "Configure complaint categories and routing",
  "fyp.decide": "Decide FYP applications & assign supervisors",
  "resources.manage": "Manage resource requests and allocations",
  "inventory.manage": "Manage inventory",
  "internships.post": "Publish internships",
  broadcast: "Send broadcasts",
  "reports.view": "View operational reports",
  "clashes.view": "View scheduling clashes",
  "clashes.manage": "Resolve scheduling clashes",
  "timetable.manage": "Edit the class timetable",
  "attendance.manage": "Mark attendance",
  "marks.manage": "Enter marks and publish results",
  "assignments.manage": "Create assignments and grade submissions",
  "students.search": "Search student records",
  "messages.send": "Send internal messages",
  "audit.view": "Read the audit log",
  "users.manage": "Manage users and roles",
  "knowledge.manage": "Manage the AI assistant's knowledge base",
  "profiles.manage": "Manage user profile photos",
};
