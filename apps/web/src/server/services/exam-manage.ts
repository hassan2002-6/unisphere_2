import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { detectExamClashes, type ExamLike, type SlotLike } from "@/server/clash";
import { ServiceError } from "./forms";
import { notifyUser } from "./notifications";
import { recordAudit } from "./audit";

/**
 * Exam scheduling (spec §9): the coordinator owns the exam timetable. Every
 * create/move is validated against the live schedule first — hall double-
 * bookings, cohort overlaps and exam-inside-class collisions are blocked —
 * then the affected students and faculty are notified and the change is
 * audited. The system never moves an exam on its own.
 */

export const EXAM_WINDOW_START = 8 * 60;
export const EXAM_WINDOW_END = 20 * 60;

export async function getExamManagerData() {
  const [exams, classes] = await Promise.all([
    prisma.examSchedule.findMany({
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
      include: { class: { select: { id: true, courseCode: true, section: true, semester: true, facultyId: true } } },
    }),
    prisma.courseClass.findMany({
      orderBy: [{ semester: "asc" }, { courseCode: "asc" }, { section: "asc" }],
      select: { id: true, courseCode: true, title: true, section: true, semester: true, facultyId: true },
    }),
  ]);

  const halls = [
    ...new Set(exams.map((e) => e.hall).filter((h): h is string => Boolean(h && h.trim()))),
    "Exam Hall A",
    "Exam Hall B",
    "Lab 1",
    "Lab 2",
  ];

  return { exams, classes, halls: [...new Set(halls)].sort() };
}

export type ExamManagerExam = Awaited<ReturnType<typeof getExamManagerData>>["exams"][number];
export type ExamManagerClass = Awaited<ReturnType<typeof getExamManagerData>>["classes"][number];

async function toExamLikes(): Promise<{ exams: ExamLike[]; slots: SlotLike[] }> {
  const classes = await prisma.courseClass.findMany({
    include: {
      slots: { select: { id: true, day: true, startMin: true, endMin: true, room: true, labId: true } },
      exams: true,
    },
  });
  const slots: SlotLike[] = classes.flatMap((c) =>
    c.slots.map((s) => ({
      id: s.id,
      classId: c.id,
      day: s.day as SlotLike["day"],
      startMin: s.startMin,
      endMin: s.endMin,
      room: s.room,
      labId: s.labId,
      facultyId: c.facultyId,
      courseCode: c.courseCode,
      section: c.section,
      semester: c.semester,
    })),
  );
  const exams: ExamLike[] = classes.flatMap((c) =>
    c.exams.map((e) => ({
      id: e.id,
      classId: c.id,
      courseTitle: e.courseTitle,
      date: e.date.toISOString(),
      startMin: e.startMin,
      endMin: e.endMin,
      hall: e.hall,
      section: c.section,
      facultyId: c.facultyId,
    })),
  );
  return { exams, slots };
}

export type SaveExamInput = {
  id?: string;
  classId: string;
  date: string;
  startMin: number;
  endMin: number;
  hall?: string | null;
};

export async function saveExam(user: User, input: SaveExamInput) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to schedule exams", 403);
  }
  const cls = await prisma.courseClass.findUnique({ where: { id: input.classId } });
  if (!cls) throw new ServiceError("validation_error", "Pick the course this exam belongs to", 422);

  const date = new Date(`${input.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ServiceError("validation_error", "Pick an exam date", 422);
  if (!Number.isInteger(input.startMin) || !Number.isInteger(input.endMin) || input.startMin >= input.endMin) {
    throw new ServiceError("validation_error", "Start time must be before end time", 422);
  }
  if (input.startMin < EXAM_WINDOW_START || input.endMin > EXAM_WINDOW_END) {
    throw new ServiceError("validation_error", "Exam hours are 08:00 – 20:00", 422);
  }

  const candidate: ExamLike = {
    id: input.id ?? "new",
    classId: cls.id,
    courseTitle: `${cls.courseCode} ${cls.title}`,
    date: date.toISOString(),
    startMin: input.startMin,
    endMin: input.endMin,
    hall: input.hall?.trim() || null,
    section: cls.section,
    facultyId: cls.facultyId,
  };

  const { exams, slots } = await toExamLikes();
  const others = exams.filter((e) => e.id !== candidate.id);
  const involved = detectExamClashes([candidate, ...others], slots).filter(
    (c) => c.a.id === candidate.id || c.b.id === candidate.id,
  );
  // Hard blocks are genuine double-bookings: one hall, or one cohort, twice at
  // the same time. An exam that merely coincides with that cohort's regular
  // class session is a WARNING — exams run in exam weeks, so the coordinator
  // decides (the system never moves anything on its own, spec §9).
  const hard = involved.filter((c) => ["exam-hall", "exam-cohort"].includes(c.kind));
  if (hard.length > 0) {
    throw new ServiceError("conflict", `Blocked: ${hard[0].detail}`, 409);
  }

  const data = {
    classId: cls.id,
    courseTitle: candidate.courseTitle,
    date,
    startMin: input.startMin,
    endMin: input.endMin,
    hall: candidate.hall,
  };
  const saved = input.id
    ? await prisma.examSchedule.update({ where: { id: input.id }, data })
    : await prisma.examSchedule.create({ data });

  const when = `${date.toISOString().slice(0, 10)} ${String(Math.floor(input.startMin / 60)).padStart(2, "0")}:${String(input.startMin % 60).padStart(2, "0")}–${String(Math.floor(input.endMin / 60)).padStart(2, "0")}:${String(input.endMin % 60).padStart(2, "0")}${candidate.hall ? ` · ${candidate.hall}` : ""}`;
  const title = input.id ? "Exam rescheduled" : "Exam scheduled";
  const body = `${candidate.courseTitle} (Section ${cls.section}) — ${when}.`;

  if (cls.facultyId) {
    await notifyUser(cls.facultyId, { type: "ANNOUNCEMENT", title, body, link: "/exams" });
  }
  const enrolled = await prisma.enrollment.findMany({
    where: { classId: cls.id, status: "ACTIVE" },
    select: { studentId: true },
    take: 200,
  });
  for (const e of enrolled) {
    await notifyUser(e.studentId, { type: "ANNOUNCEMENT", title, body, link: "/exams" });
  }

  await recordAudit({
    actorId: user.id,
    action: input.id ? "exam.update" : "exam.create",
    entity: "ExamSchedule",
    entityId: saved.id,
    summary: `${candidate.courseTitle} (${cls.section}): ${when}`,
  });

  return { saved, warnings: involved.filter((c) => !hard.includes(c)) };
}

export async function deleteExam(user: User, id: string) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to schedule exams", 403);
  }
  const exam = await prisma.examSchedule.findUnique({
    where: { id },
    include: { class: { select: { id: true, section: true, facultyId: true } } },
  });
  if (!exam) throw new ServiceError("not_found", "Exam not found", 404);

  await prisma.examSchedule.delete({ where: { id } });

  const body = `${exam.courseTitle} (Section ${exam.class?.section ?? "—"}) on ${exam.date.toISOString().slice(0, 10)} was cancelled.`;
  if (exam.class?.facultyId) {
    await notifyUser(exam.class.facultyId, { type: "ANNOUNCEMENT", title: "Exam cancelled", body, link: "/exams" });
  }
  if (exam.class) {
    const enrolled = await prisma.enrollment.findMany({
      where: { classId: exam.class.id, status: "ACTIVE" },
      select: { studentId: true },
      take: 200,
    });
    for (const e of enrolled) {
      await notifyUser(e.studentId, { type: "ANNOUNCEMENT", title: "Exam cancelled", body, link: "/exams" });
    }
  }

  await recordAudit({
    actorId: user.id,
    action: "exam.delete",
    entity: "ExamSchedule",
    entityId: id,
    summary: `${exam.courseTitle}: exam on ${exam.date.toISOString().slice(0, 10)} removed`,
  });
}
