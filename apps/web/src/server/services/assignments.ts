import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { toBytes } from "@/server/bytes";
import { recordAudit } from "./audit";
import { notifyUser } from "./notifications";
import { ServiceError } from "./forms";

export { ServiceError } from "./forms";

/**
 * Assignments service (spec §4). Faculty author assignments for the courses
 * they teach; enrolled students see them, submit a file (type/size/deadline
 * validated server-side) and get marks + feedback back. Files live in Postgres
 * (bytea) and are only ever served through authorized route handlers — never
 * as public assets.
 */

/** Upload ceiling for student submissions and faculty attachments. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Extension → accepted MIME types. Extensions are what `allowedTypes` names. */
export const UPLOAD_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
};

export const DEFAULT_ALLOWED_TYPES = Object.keys(UPLOAD_TYPES);

/** Normalise the comma list faculty type ("pdf, docx") into known extensions. */
export function normaliseAllowedTypes(input?: string | null): string[] {
  if (!input) return DEFAULT_ALLOWED_TYPES;
  const known = input
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase().replace(/^\./, ""))
    .filter((e) => e in UPLOAD_TYPES);
  return known.length > 0 ? [...new Set(known)] : DEFAULT_ALLOWED_TYPES;
}

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

/** Server-side upload gate: size first, then extension vs the assignment's list. */
export function validateUpload(
  file: { name: string; size: number },
  allowed: string[],
): { ok: true } | { ok: false; error: string } {
  if (!file.name || file.name.length > 200) return { ok: false, error: "Missing or invalid file name" };
  if (file.size <= 0) return { ok: false, error: "The file is empty" };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `Files must be ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB or smaller` };
  }
  const ext = extensionOf(file.name);
  if (!ext || !allowed.includes(ext)) {
    return { ok: false, error: `Only these file types are accepted: ${allowed.join(", ")}` };
  }
  return { ok: true };
}

/** A student may submit when the assignment is open (not closed by faculty). */
export function assignmentOpen(assignment: { closedAt: Date | null }): boolean {
  return !assignment.closedAt;
}

export function isLateSubmission(deadline: Date, now = new Date()): boolean {
  return now.getTime() > deadline.getTime();
}

async function classesForStudent(studentId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({ where: { studentId }, select: { classId: true } });
  return rows.map((r) => r.classId);
}

async function assertCanManageClass(user: User, classId: string) {
  if (!can(user.role, "assignments.manage")) {
    throw new ServiceError("forbidden", "Only faculty can manage assignments", 403);
  }
  if (user.role === "ADMIN") return;
  const cls = await prisma.courseClass.findUnique({ where: { id: classId }, select: { facultyId: true } });
  if (!cls || cls.facultyId !== user.id) {
    throw new ServiceError("forbidden", "You can only manage assignments for courses you teach", 403);
  }
}

async function enrolledStudentIds(classId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({ where: { classId }, select: { studentId: true } });
  return rows.map((r) => r.studentId);
}

// ── Reads ────────────────────────────────────────────────────────────────

/** Student view: every assignment of the classes they are enrolled in + their own status. */
export async function listMyAssignments(user: User) {
  return prisma.assignment.findMany({
    where: { class: { enrollments: { some: { studentId: user.id } } } },
    orderBy: [{ deadline: "asc" }],
    take: 200,
    include: {
      class: { select: { id: true, courseCode: true, title: true, section: true } },
      submissions: {
        where: { studentId: user.id },
        select: { id: true, submittedAt: true, isLate: true, attempt: true, marks: true, feedback: true, gradedAt: true, fileName: true },
      },
    },
  });
}

/** Student detail view — 404 unless the student is enrolled in that class. */
export async function getMyAssignment(user: User, assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, class: { enrollments: { some: { studentId: user.id } } } },
    include: {
      class: { select: { id: true, courseCode: true, title: true, section: true } },
      createdBy: { select: { name: true } },
      submissions: { where: { studentId: user.id } },
    },
  });
  if (!assignment) throw new ServiceError("not_found", "Assignment not found", 404);
  return assignment;
}

/** Faculty view: assignments of every class they teach + submission counters. */
export async function listFacultyAssignments(user: User) {
  if (!can(user.role, "assignments.manage")) {
    throw new ServiceError("forbidden", "Only faculty can manage assignments", 403);
  }
  const where = user.role === "ADMIN" ? {} : { class: { facultyId: user.id } };
  return prisma.assignment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: {
      class: { select: { id: true, courseCode: true, title: true, section: true } },
      _count: { select: { submissions: true } },
      submissions: { select: { isLate: true, gradedAt: true } },
    },
  });
}

/** Faculty detail: assignment + full roster with each student's submission state. */
export async function getFacultyAssignment(user: User, assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { id: true, courseCode: true, title: true, section: true, facultyId: true } },
      submissions: {
        orderBy: { submittedAt: "asc" },
        include: {
          student: { select: { id: true, name: true, registrationNo: true, email: true } },
          gradedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!assignment) throw new ServiceError("not_found", "Assignment not found", 404);
  if (user.role !== "ADMIN" && assignment.class.facultyId !== user.id) {
    throw new ServiceError("forbidden", "You can only review submissions for courses you teach", 403);
  }
  const roster = await prisma.enrollment.findMany({
    where: { classId: assignment.classId },
    orderBy: { student: { registrationNo: "asc" } },
    include: { student: { select: { id: true, name: true, registrationNo: true, email: true } } },
  });
  return { assignment, roster: roster.map((r) => r.student) };
}

/** File bytes for a submission — owner student, class faculty, or admin. */
export async function getSubmissionFile(user: User, submissionId: string) {
  const sub = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { class: { select: { facultyId: true } } } } },
  });
  if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
  const isOwner = sub.studentId === user.id;
  const isClassFaculty = sub.assignment.class.facultyId === user.id || sub.assignment.createdById === user.id;
  if (!isOwner && !isClassFaculty && user.role !== "ADMIN") {
    throw new ServiceError("forbidden", "Not allowed to download this submission", 403);
  }
  return { fileName: sub.fileName, mime: sub.fileMime, data: sub.fileData };
}

/** File bytes for the faculty attachment — students of the class + staff. */
export async function getAssignmentAttachment(user: User, assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: { select: { facultyId: true } } },
  });
  if (!assignment?.attachmentData || !assignment.attachmentName) {
    throw new ServiceError("not_found", "No attachment on this assignment", 404);
  }
  const enrolled = await prisma.enrollment.count({ where: { classId: assignment.classId, studentId: user.id } });
  const allowed = enrolled > 0 || assignment.class.facultyId === user.id || assignment.createdById === user.id || user.role === "ADMIN";
  if (!allowed) throw new ServiceError("forbidden", "Not allowed to download this attachment", 403);
  return { fileName: assignment.attachmentName, mime: assignment.attachmentMime ?? "application/octet-stream", data: assignment.attachmentData };
}

// ── Writes ───────────────────────────────────────────────────────────────

export type CreateAssignmentInput = {
  classId: string;
  title: string;
  instructions: string;
  deadline: Date;
  maxMarks: number;
  allowedTypes?: string;
  attachment?: { name: string; mime: string; data: Buffer } | null;
};

export async function createAssignment(user: User, input: CreateAssignmentInput) {
  const title = input.title.trim().slice(0, 150);
  const instructions = input.instructions.trim().slice(0, 6000);
  if (title.length < 4) throw new ServiceError("validation_error", "Title is too short", 422);
  if (instructions.length < 10) throw new ServiceError("validation_error", "Instructions are too short", 422);
  if (Number.isNaN(input.deadline.getTime())) throw new ServiceError("validation_error", "Invalid deadline", 422);
  if (input.deadline.getTime() < Date.now() - 60_000) {
    throw new ServiceError("validation_error", "The deadline must be in the future", 422);
  }
  const maxMarks = Math.floor(input.maxMarks);
  if (!Number.isFinite(maxMarks) || maxMarks < 1 || maxMarks > 1000) {
    throw new ServiceError("validation_error", "Max marks must be between 1 and 1000", 422);
  }
  await assertCanManageClass(user, input.classId);
  const allowed = normaliseAllowedTypes(input.allowedTypes);

  const created = await prisma.assignment.create({
    data: {
      classId: input.classId,
      title,
      instructions,
      deadline: input.deadline,
      maxMarks,
      allowedTypes: allowed.join(","),
      attachmentName: input.attachment?.name ?? null,
      attachmentMime: input.attachment?.mime ?? null,
      attachmentSize: input.attachment?.data.length ?? null,
      attachmentData: input.attachment ? toBytes(input.attachment.data) : null,
      createdById: user.id,
    },
  });

  const students = await enrolledStudentIds(input.classId);
  for (const studentId of students) {
    await notifyUser(studentId, {
      type: "ASSIGNMENT",
      title: "New assignment posted",
      body: `"${title}" is due ${input.deadline.toLocaleDateString()}.`,
      link: `/assignments/${created.id}`,
    });
  }
  await recordAudit({
    actorId: user.id,
    action: "assignment.create",
    entity: "Assignment",
    entityId: created.id,
    summary: `Assignment "${title}" posted to ${input.classId} (${students.length} students notified)`,
  });
  return created;
}

export async function updateAssignment(
  user: User,
  assignmentId: string,
  patch: Partial<Pick<CreateAssignmentInput, "title" | "instructions" | "deadline" | "maxMarks" | "allowedTypes">> & {
    closed?: boolean;
  },
) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ServiceError("not_found", "Assignment not found", 404);
  await assertCanManageClass(user, assignment.classId);

  const data: Record<string, unknown> = {};
  const notes: string[] = [];
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 150);
    if (t.length < 4) throw new ServiceError("validation_error", "Title is too short", 422);
    data.title = t;
    notes.push("title");
  }
  if (patch.instructions !== undefined) {
    const i = patch.instructions.trim().slice(0, 6000);
    if (i.length < 10) throw new ServiceError("validation_error", "Instructions are too short", 422);
    data.instructions = i;
  }
  let deadlineChanged = false;
  if (patch.deadline !== undefined) {
    if (Number.isNaN(patch.deadline.getTime())) throw new ServiceError("validation_error", "Invalid deadline", 422);
    deadlineChanged = patch.deadline.getTime() !== assignment.deadline.getTime();
    data.deadline = patch.deadline;
    if (deadlineChanged) notes.push("deadline");
  }
  if (patch.maxMarks !== undefined) {
    const m = Math.floor(patch.maxMarks);
    if (!Number.isFinite(m) || m < 1 || m > 1000) throw new ServiceError("validation_error", "Max marks must be between 1 and 1000", 422);
    data.maxMarks = m;
  }
  if (patch.allowedTypes !== undefined) data.allowedTypes = normaliseAllowedTypes(patch.allowedTypes).join(",");
  if (patch.closed !== undefined) {
    data.closedAt = patch.closed ? new Date() : null;
    notes.push(patch.closed ? "closed" : "reopened");
  }

  const updated = await prisma.assignment.update({ where: { id: assignmentId }, data });

  if (deadlineChanged || patch.closed === true) {
    const students = await enrolledStudentIds(assignment.classId);
    for (const studentId of students) {
      await notifyUser(studentId, {
        type: "ASSIGNMENT",
        title: deadlineChanged ? "Assignment deadline changed" : "Assignment closed",
        body: deadlineChanged
          ? `"${updated.title}" is now due ${updated.deadline.toLocaleDateString()}.`
          : `"${updated.title}" was closed by ${user.name}. Contact your instructor if you are affected.`,
        link: `/assignments/${updated.id}`,
      });
    }
  }
  await recordAudit({
    actorId: user.id,
    action: "assignment.update",
    entity: "Assignment",
    entityId: assignmentId,
    summary: `Assignment "${updated.title}" updated${notes.length ? ` (${notes.join(", ")})` : ""}`,
  });
  return updated;
}

export type SubmitInput = {
  fileName: string;
  fileMime: string;
  fileData: Buffer;
  note?: string;
};

/** Student submission (or resubmission until graded). Late submissions are flagged, not blocked. */
export async function submitAssignment(user: User, assignmentId: string, input: SubmitInput) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, class: { enrollments: { some: { studentId: user.id } } } },
    include: { class: { select: { facultyId: true, courseCode: true } } },
  });
  if (!assignment) throw new ServiceError("not_found", "Assignment not found", 404);
  if (!assignmentOpen(assignment)) throw new ServiceError("conflict", "This assignment is closed", 409);

  const allowed = normaliseAllowedTypes(assignment.allowedTypes);
  const check = validateUpload({ name: input.fileName, size: input.fileData.length }, allowed);
  if (!check.ok) throw new ServiceError("validation_error", check.error, 422);

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
  });
  if (existing?.gradedAt) {
    throw new ServiceError("conflict", "This submission has already been graded — contact your instructor to reopen it", 409);
  }
  const late = isLateSubmission(assignment.deadline);

  const row = await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    create: {
      assignmentId,
      studentId: user.id,
      fileName: input.fileName,
      fileMime: input.fileMime,
      fileSize: input.fileData.length,
      fileData: toBytes(input.fileData),
      note: input.note?.trim().slice(0, 1000) || null,
      isLate: late,
    },
    update: {
      fileName: input.fileName,
      fileMime: input.fileMime,
      fileSize: input.fileData.length,
      fileData: toBytes(input.fileData),
      note: input.note?.trim().slice(0, 1000) || null,
      submittedAt: new Date(),
      isLate: late,
      attempt: { increment: 1 },
    },
  });

  const facultyIds = new Set<string>([assignment.createdById]);
  if (assignment.class.facultyId) facultyIds.add(assignment.class.facultyId);
  for (const fid of facultyIds) {
    await notifyUser(fid, {
      type: "ASSIGNMENT",
      title: "New assignment submission",
      body: `${user.name} submitted "${assignment.title}"${late ? " (late)" : ""}.`,
      link: `/faculty/assignments/${assignment.id}`,
    });
  }
  await recordAudit({
    actorId: user.id,
    action: "assignment.submit",
    entity: "AssignmentSubmission",
    entityId: row.id,
    summary: `Submission for "${assignment.title}" (attempt ${row.attempt}${late ? ", late" : ""})`,
  });
  return row;
}

export async function gradeSubmission(user: User, submissionId: string, input: { marks: number; feedback?: string }) {
  const sub = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { class: { select: { facultyId: true } } } } },
  });
  if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
  if (user.role !== "ADMIN" && sub.assignment.class.facultyId !== user.id && sub.assignment.createdById !== user.id) {
    throw new ServiceError("forbidden", "You can only grade submissions for courses you teach", 403);
  }
  const marks = Math.floor(input.marks);
  if (!Number.isFinite(marks) || marks < 0 || marks > sub.assignment.maxMarks) {
    throw new ServiceError("validation_error", `Marks must be between 0 and ${sub.assignment.maxMarks}`, 422);
  }
  const graded = await prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { marks, feedback: input.feedback?.trim().slice(0, 2000) || null, gradedById: user.id, gradedAt: new Date() },
  });
  await notifyUser(sub.studentId, {
    type: "ASSIGNMENT",
    title: "Assignment graded",
    body: `"${sub.assignment.title}": ${marks}/${sub.assignment.maxMarks}${graded.feedback ? ` — ${graded.feedback}` : ""}`,
    link: `/assignments/${sub.assignmentId}`,
  });
  await recordAudit({
    actorId: user.id,
    action: "assignment.grade",
    entity: "AssignmentSubmission",
    entityId: submissionId,
    summary: `Graded "${sub.assignment.title}" ${marks}/${sub.assignment.maxMarks}`,
  });
  return graded;
}

/** Classes this student can file a course-related complaint against. */
export async function classesForComplaint(user: User) {
  const ids = await classesForStudent(user.id);
  if (ids.length === 0) return [];
  return prisma.courseClass.findMany({
    where: { id: { in: ids } },
    select: { id: true, courseCode: true, title: true, section: true },
    orderBy: { courseCode: "asc" },
  });
}
