import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { recordAudit } from "./audit";
import { gradeFor } from "./marks";

/**
 * Student search + permitted profile view (spec §6, §7, §14).
 *
 * Authorization: only roles holding `students.search` (FACULTY, COORDINATOR,
 * FYP_HEAD, ADMIN — enforced by the calling page) can reach this service.
 * What's returned is deliberately scoped to *academic* information: identity,
 * program, enrolled courses, attendance and marks. Complaints, messages and
 * other private records never leave their own services.
 */

export type StudentSearchRow = {
  id: string;
  name: string;
  email: string;
  registrationNo: string | null;
  department: string | null;
  semester: number | null;
  section: string | null;
  program: string | null;
};

export async function searchStudents(
  query: string,
  opts?: { courseCode?: string; semester?: number; take?: number },
): Promise<StudentSearchRow[]> {
  const q = query.trim();
  const where: Record<string, unknown> = { role: "STUDENT" };
  const and: Record<string, unknown>[] = [];

  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { registrationNo: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (opts?.semester) {
    and.push({ studentProfile: { semester: opts.semester } });
  }
  if (opts?.courseCode) {
    and.push({
      enrollments: { some: { class: { courseCode: { contains: opts.courseCode, mode: "insensitive" } } } },
    });
  }
  if (and.length) where.AND = and;

  const rows = await prisma.user.findMany({
    where,
    take: opts?.take ?? 25,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      registrationNo: true,
      department: true,
      studentProfile: { select: { semester: true, section: true, program: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    registrationNo: r.registrationNo,
    department: r.department,
    semester: r.studentProfile?.semester ?? null,
    section: r.studentProfile?.section ?? null,
    program: r.studentProfile?.program ?? null,
  }));
}

export type PermittedStudentProfile = Awaited<ReturnType<typeof getStudentAcademicProfile>>;

/**
 * The permitted academic profile for one student: identity, courses with
 * attendance %, current assessments, and published results (GPA/CGPA).
 * Every caller must hold `students.search`; `viewer` is used for the shared
 * course annotation so faculty see which classes are theirs.
 */
export async function getStudentAcademicProfile(viewer: User, studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      registrationNo: true,
      createdAt: true,
      role: true,
      studentProfile: true,
      enrollments: {
        orderBy: { class: { courseCode: "asc" } },
        include: {
          class: {
            include: {
              faculty: { select: { name: true } },
              assessments: { include: { scores: { where: { studentId } } } },
              results: { where: { studentId, published: true } },
            },
          },
        },
      },
      attendance: { select: { classId: true, status: true, date: true } },
    },
  });
  if (!student || student.role !== "STUDENT") return null;

  const attendanceByClass = new Map<string, { present: number; late: number; absent: number; excused: number }>();
  for (const a of student.attendance) {
    const entry = attendanceByClass.get(a.classId) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    if (a.status === "PRESENT") entry.present++;
    else if (a.status === "LATE") entry.late++;
    else if (a.status === "ABSENT") entry.absent++;
    else entry.excused++;
    attendanceByClass.set(a.classId, entry);
  }

  const claimedClassIds = new Set(
    (
      await prisma.courseClass.findMany({
        where: { facultyId: viewer.id },
        select: { id: true },
      })
    ).map((c) => c.id),
  );

  const courses = student.enrollments
    .filter((e) => e.status === "ACTIVE")
    .map((e) => {
      const cls = e.class;
      const att = attendanceByClass.get(cls.id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      const countable = att.present + att.late + att.absent;
      const pct = countable > 0 ? Math.round(((att.present + att.late) / countable) * 100) : null;
      const scored = cls.assessments.reduce(
        (sum, a) => sum + (a.scores[0]?.marks ?? 0),
        0,
      );
      const scoredMax = cls.assessments.reduce((sum, a) => sum + a.maxMarks, 0);
      const midPct = scoredMax > 0 ? Math.round((scored / scoredMax) * 100) : null;
      return {
        classId: cls.id,
        courseCode: cls.courseCode,
        title: cls.title,
        section: cls.section,
        semester: cls.semester,
        faculty: cls.faculty?.name ?? "Unassigned",
        mine: claimedClassIds.has(cls.id),
        attendancePct: pct,
        attendanceCounts: att,
        midtermPct: midPct,
        midtermGrade: midPct !== null ? gradeFor(midPct)[0] : null,
      };
    });

  const results = student.enrollments
    .filter((e) => e.status !== "ACTIVE" && e.class.results[0]?.published)
    .map((e) => ({
      courseCode: e.class.courseCode,
      title: e.class.title,
      semester: e.class.semester,
      credits: e.class.credits ?? 3,
      grade: e.class.results[0].grade,
      gradePoints: e.class.results[0].gradePoints,
      totalMarks: e.class.results[0].totalMarks,
    }));

  const usable = results.filter((r) => r.gradePoints !== null);
  const credits = usable.reduce((sum, r) => sum + r.credits, 0);
  const cgpa = credits > 0
    ? Math.round((usable.reduce((sum, r) => sum + (r.gradePoints ?? 0) * r.credits, 0) / credits) * 100) / 100
    : null;

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      department: student.department,
      registrationNo: student.registrationNo,
      profile: student.studentProfile,
      memberSince: student.createdAt,
    },
    courses,
    results,
    cgpa,
  };
}

/** Audit a student-profile view (spec §18 — important actions are logged). */
export async function recordProfileView(viewer: User, studentId: string, studentName: string) {
  await recordAudit({
    actorId: viewer.id,
    action: "student.view",
    entity: "User",
    entityId: studentId,
    summary: `Viewed academic profile of ${studentName}`,
  });
}
