import { prisma } from "@/lib/db";
import type { AttendanceStatus, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";

/**
 * Attendance (spec §5 "view attendance", §6 "mark/update attendance").
 * A record is one (student, class, date) triple — the same shape the seed
 * writes, so marking from the UI updates the seeded history rather than
 * duplicating it.
 */

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

/** "2026-10-08" → local midnight (matches how the seed stores dates). */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type CourseAttendance = {
  classId: string;
  courseCode: string;
  title: string;
  section: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  pct: number; // attended (present + late) over countable sessions
};

export type AttendanceSession = {
  id: string;
  date: Date;
  status: AttendanceStatus;
  classId: string;
  courseCode: string;
  title: string;
};

export async function getStudentAttendance(user: User) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id, status: "ACTIVE" },
    include: { class: true },
    orderBy: { class: { courseCode: "asc" } },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: user.id, classId: { in: enrollments.map((e) => e.classId) } },
    orderBy: { date: "desc" },
  });

  const byClass = new Map<string, typeof records>();
  for (const r of records) {
    const list = byClass.get(r.classId) ?? [];
    list.push(r);
    byClass.set(r.classId, list);
  }

  const courses: CourseAttendance[] = enrollments.map((e) => {
    const list = byClass.get(e.classId) ?? [];
    const present = list.filter((r) => r.status === "PRESENT").length;
    const late = list.filter((r) => r.status === "LATE").length;
    const absent = list.filter((r) => r.status === "ABSENT").length;
    const excused = list.filter((r) => r.status === "EXCUSED").length;
    const total = list.length;
    const countable = total - excused;
    const pct = countable > 0 ? Math.round(((present + late) / countable) * 100) : 100;
    return {
      classId: e.classId,
      courseCode: e.class.courseCode,
      title: e.class.title,
      section: e.class.section,
      present,
      late,
      absent,
      excused,
      total,
      pct,
    };
  });

  const totals = courses.reduce(
    (acc, c) => ({
      present: acc.present + c.present,
      late: acc.late + c.late,
      absent: acc.absent + c.absent,
      excused: acc.excused + c.excused,
      total: acc.total + c.total,
    }),
    { present: 0, late: 0, absent: 0, excused: 0, total: 0 },
  );
  const countable = totals.total - totals.excused;
  const overall = {
    ...totals,
    pct: countable > 0 ? Math.round(((totals.present + totals.late) / countable) * 100) : 100,
  };

  const courseById = new Map(courses.map((c) => [c.classId, c]));
  const recent: AttendanceSession[] = records.slice(0, 20).map((r) => ({
    id: r.id,
    date: r.date,
    status: r.status,
    classId: r.classId,
    courseCode: courseById.get(r.classId)?.courseCode ?? "—",
    title: courseById.get(r.classId)?.title ?? "",
  }));

  return { courses, overall, recent };
}

export type SessionRosterRow = {
  studentId: string;
  name: string;
  registrationNo: string | null;
  status: AttendanceStatus | null;
};

/** Faculty-facing: one class session (roster + any marks already recorded). */
export async function getClassSession(user: User, classId: string, dateISO: string) {
  const cls = await prisma.courseClass.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found");
  const isStaffManager = can(user.role, "clashes.manage") || user.role === "ADMIN";
  if (cls.facultyId !== user.id && !isStaffManager) throw new Error("Not your class");

  const date = parseDateOnly(dateISO);
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    include: { student: { select: { id: true, name: true, registrationNo: true } } },
    orderBy: { student: { registrationNo: "asc" } },
  });
  const existing = await prisma.attendanceRecord.findMany({ where: { classId, date } });
  const byStudent = new Map(existing.map((r) => [r.studentId, r.status]));

  const roster: SessionRosterRow[] = enrollments.map((e) => ({
    studentId: e.student.id,
    name: e.student.name,
    registrationNo: e.student.registrationNo,
    status: byStudent.get(e.student.id) ?? null,
  }));

  return { cls, date, roster, marked: existing.length > 0 };
}

/** Faculty-facing: mark (or re-mark) one session. */
export async function markAttendance(
  user: User,
  classId: string,
  dateISO: string,
  entries: { studentId: string; status: AttendanceStatus }[],
) {
  const cls = await prisma.courseClass.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found");
  const isStaffManager = can(user.role, "clashes.manage") || user.role === "ADMIN";
  if (cls.facultyId !== user.id && !isStaffManager) throw new Error("Not your class");

  const date = parseDateOnly(dateISO);
  const enrollmentIds = new Set(
    (
      await prisma.enrollment.findMany({ where: { classId, status: "ACTIVE" }, select: { studentId: true } })
    ).map((e) => e.studentId),
  );

  let written = 0;
  for (const entry of entries) {
    if (!enrollmentIds.has(entry.studentId)) continue;
    await prisma.attendanceRecord.upsert({
      where: {
        studentId_classId_date: { studentId: entry.studentId, classId, date },
      },
      update: { status: entry.status, markedById: user.id, markedAt: new Date() },
      create: {
        studentId: entry.studentId,
        classId,
        date,
        status: entry.status,
        markedById: user.id,
      },
    });
    written++;
  }

  await recordAudit({
    actorId: user.id,
    action: "attendance.mark",
    entity: "CourseClass",
    entityId: classId,
    summary: `Attendance marked for ${cls.courseCode} (${dateISO}) — ${written} students`,
    meta: { date: dateISO, students: written },
  });
  return { written };
}

/** Faculty-facing overview: their classes + attendance share so far. */
export async function getFacultyAttendanceOverview(user: User) {
  const classes = await prisma.courseClass.findMany({
    where: { facultyId: user.id, enrollments: { some: { status: "ACTIVE" } } },
    orderBy: { courseCode: "asc" },
    include: { enrollments: { where: { status: "ACTIVE" }, select: { id: true } } },
  });
  const rows = [];
  for (const c of classes) {
    const records = await prisma.attendanceRecord.findMany({
      where: { classId: c.id },
      select: { status: true, date: true },
    });
    const sessions = new Set(records.map((r) => r.date.toISOString().slice(0, 10))).size;
    const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
    const pct = records.length ? Math.round((present / records.length) * 100) : 100;
    const last = records.map((r) => r.date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    rows.push({
      classId: c.id,
      courseCode: c.courseCode,
      title: c.title,
      section: c.section,
      students: c.enrollments.length,
      sessions,
      pct,
      lastMarked: last,
      today: toDateOnly(new Date()),
    });
  }
  return rows;
}
