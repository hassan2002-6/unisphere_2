import { prisma } from "@/lib/db";
import type { AssessmentKind, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { notifyUser } from "./notifications";

/**
 * Marks & results (spec §5 "marks/results + GPA/CGPA", §6 "enter/update marks").
 *
 * Model: assessments hold the marks for the running semester; CourseResult is
 * the *published* grade (letter + points) that feeds GPA/CGPA. Publishing a
 * class computes each student's total from their assessment percentages.
 */

const GRADE_SCALE: [number, string, number][] = [
  [90, "A+", 4.0],
  [85, "A", 3.75],
  [80, "B+", 3.5],
  [75, "B", 3.0],
  [70, "C+", 2.5],
  [65, "C", 2.0],
  [50, "D", 1.0],
  [0, "F", 0.0],
];

/** Percentage → [letter, grade points] (same scale as the seed). */
export function gradeFor(pct: number): [string, number] {
  for (const [min, letter, points] of GRADE_SCALE) {
    if (pct >= min) return [letter, points];
  }
  return ["F", 0.0];
}

export function gpaFromResults(results: { gradePoints: number | null; credits: number | null }[]): number | null {
  const usable = results.filter((r) => r.gradePoints !== null);
  if (usable.length === 0) return null;
  const credits = usable.reduce((sum, r) => sum + (r.credits ?? 3), 0);
  const points = usable.reduce((sum, r) => sum + (r.gradePoints ?? 0) * (r.credits ?? 3), 0);
  return credits > 0 ? Math.round((points / credits) * 100) / 100 : null;
}

export type MarkAssessment = {
  id: string;
  kind: AssessmentKind;
  title: string;
  maxMarks: number;
  date: Date | null;
  marks: number | null;
  classAvg: number | null;
};

export type MarkCourse = {
  classId: string;
  courseCode: string;
  title: string;
  section: string;
  credits: number;
  assessments: MarkAssessment[];
  scored: number;
  scoredMax: number;
  pct: number | null;
  projectedGrade: string | null;
  published: { totalMarks: number | null; grade: string | null; gradePoints: number | null } | null;
};

export type ResultCourse = {
  classId: string;
  courseCode: string;
  title: string;
  semester: string;
  credits: number;
  totalMarks: number | null;
  grade: string | null;
  gradePoints: number | null;
};

export async function getStudentMarks(user: User) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    include: {
      class: {
        include: {
          assessments: { include: { scores: true }, orderBy: { createdAt: "asc" } },
          results: { where: { studentId: user.id } },
        },
      },
    },
  });

  const current: MarkCourse[] = [];
  const results: ResultCourse[] = [];

  for (const e of enrollments) {
    const cls = e.class;
    if (e.status !== "ACTIVE") {
      const r = cls.results[0];
      if (r?.published) {
        results.push({
          classId: cls.id,
          courseCode: cls.courseCode,
          title: cls.title,
          semester: cls.semester,
          credits: cls.credits ?? 3,
          totalMarks: r.totalMarks,
          grade: r.grade,
          gradePoints: r.gradePoints,
        });
      }
      continue;
    }

    const assessments: MarkAssessment[] = cls.assessments.map((a) => {
      const mine = a.scores.find((s) => s.studentId === user.id) ?? null;
      const all = a.scores.filter((s) => s.marks !== null);
      const classAvg = all.length
        ? Math.round((all.reduce((sum, s) => sum + (s.marks ?? 0), 0) / all.length) * 10) / 10
        : null;
      return {
        id: a.id,
        kind: a.kind,
        title: a.title,
        maxMarks: a.maxMarks,
        date: a.date,
        marks: mine?.marks ?? null,
        classAvg,
      };
    });

    const scored = assessments.reduce((sum, a) => sum + (a.marks ?? 0), 0);
    const scoredMax = assessments.reduce((sum, a) => sum + a.maxMarks, 0);
    const pct = scoredMax > 0 ? Math.round((scored / scoredMax) * 100) : null;
    const published = cls.results[0]
      ? {
          totalMarks: cls.results[0].totalMarks,
          grade: cls.results[0].grade,
          gradePoints: cls.results[0].gradePoints,
        }
      : null;

    current.push({
      classId: cls.id,
      courseCode: cls.courseCode,
      title: cls.title,
      section: cls.section,
      credits: cls.credits ?? 3,
      assessments,
      scored,
      scoredMax,
      pct,
      projectedGrade: pct !== null ? gradeFor(pct)[0] : null,
      published: cls.results[0]?.published ? published : null,
    });
  }

  const withPublished = current.filter((c) => c.published?.gradePoints != null);
  const semesterGpa = gpaFromResults(
    withPublished.map((c) => ({ gradePoints: c.published?.gradePoints ?? null, credits: c.credits })),
  );
  const projectedGpa = gpaFromResults(
    current
      .filter((c) => c.pct !== null)
      .map((c) => ({ gradePoints: gradeFor(c.pct ?? 0)[1], credits: c.credits })),
  );
  // CGPA counts every published result — prior semesters plus anything already
  // published this semester.
  const cgpa = gpaFromResults([
    ...results.map((r) => ({ gradePoints: r.gradePoints, credits: r.credits })),
    ...withPublished.map((c) => ({ gradePoints: c.published?.gradePoints ?? null, credits: c.credits })),
  ]);
  const totalCredits =
    results.reduce((sum, r) => sum + r.credits, 0) +
    withPublished.reduce((sum, c) => sum + c.credits, 0);

  return {
    current: current.sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    results: results.sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    semesterGpa,
    projectedGpa,
    cgpa,
    totalCredits,
  };
}

export type ClassMarksRoster = {
  studentId: string;
  name: string;
  registrationNo: string | null;
  scores: Record<string, number | null>; // assessmentId → marks
};

/** Faculty-facing: assessments + roster with the marks entered so far. */
export async function getClassMarks(user: User, classId: string) {
  const cls = await prisma.courseClass.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found");
  const isStaffManager = can(user.role, "clashes.manage") || user.role === "ADMIN";
  if (cls.facultyId !== user.id && !isStaffManager) throw new Error("Not your class");

  const assessments = await prisma.assessment.findMany({
    where: { classId },
    orderBy: { createdAt: "asc" },
    include: { scores: true },
  });
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    include: { student: { select: { id: true, name: true, registrationNo: true } } },
    orderBy: { student: { registrationNo: "asc" } },
  });

  const roster: ClassMarksRoster[] = enrollments.map((e) => {
    const scores: Record<string, number | null> = {};
    for (const a of assessments) {
      scores[a.id] = a.scores.find((s) => s.studentId === e.student.id)?.marks ?? null;
    }
    return {
      studentId: e.student.id,
      name: e.student.name,
      registrationNo: e.student.registrationNo,
      scores,
    };
  });

  return { cls, assessments, roster };
}

/** Faculty-facing class list (their active classes with assessment counts). */
export async function getFacultyMarksOverview(user: User) {
  const classes = await prisma.courseClass.findMany({
    where: { facultyId: user.id, enrollments: { some: { status: "ACTIVE" } } },
    orderBy: { courseCode: "asc" },
    include: {
      assessments: { select: { id: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      results: { where: { published: true }, select: { id: true } },
    },
  });
  return classes.map((c) => ({
    classId: c.id,
    courseCode: c.courseCode,
    title: c.title,
    section: c.section,
    students: c.enrollments.length,
    assessments: c.assessments.length,
    published: c.results.length,
  }));
}

export async function createAssessment(
  user: User,
  classId: string,
  input: { kind: AssessmentKind; title: string; maxMarks: number; date?: string },
) {
  const cls = await prisma.courseClass.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found");
  const isStaffManager = can(user.role, "clashes.manage") || user.role === "ADMIN";
  if (cls.facultyId !== user.id && !isStaffManager) throw new Error("Not your class");
  if (!input.title.trim()) throw new Error("Title required");
  if (!Number.isFinite(input.maxMarks) || input.maxMarks <= 0) throw new Error("Max marks must be positive");

  const assessment = await prisma.assessment.create({
    data: {
      classId,
      kind: input.kind,
      title: input.title.trim(),
      maxMarks: Math.round(input.maxMarks),
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id,
    action: "assessment.create",
    entity: "Assessment",
    entityId: assessment.id,
    summary: `Created "${assessment.title}" (${assessment.kind}) for ${cls.courseCode} · max ${assessment.maxMarks}`,
  });
  return assessment;
}

export async function enterScores(
  user: User,
  assessmentId: string,
  entries: { studentId: string; marks: number | null }[],
) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { class: true },
  });
  if (!assessment) throw new Error("Assessment not found");
  const cls = assessment.class;
  const isStaffManager = can(user.role, "clashes.manage") || user.role === "ADMIN";
  if (cls.facultyId !== user.id && !isStaffManager) throw new Error("Not your class");

  const enrolled = new Set(
    (await prisma.enrollment.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { studentId: true } }))
      .map((e) => e.studentId),
  );

  let written = 0;
  for (const entry of entries) {
    if (!enrolled.has(entry.studentId)) continue;
    const marks =
      entry.marks === null ? null : Math.max(0, Math.min(assessment.maxMarks, Math.round(entry.marks)));
    await prisma.score.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId: entry.studentId } },
      update: { marks, enteredById: user.id },
      create: { assessmentId, studentId: entry.studentId, marks, enteredById: user.id },
    });
    written++;
  }

  await recordAudit({
    actorId: user.id,
    action: "marks.enter",
    entity: "Assessment",
    entityId: assessmentId,
    summary: `Marks entered for ${cls.courseCode} · ${assessment.title} (${written} students)`,
    meta: { assessment: assessment.title, students: written },
  });
  return { written };
}

/**
 * Publish results for a class: each student's total = percentage across the
 * class's assessments, mapped to the letter scale. Idempotent — re-publishing
 * updates the existing CourseResult rows.
 */
export async function publishResults(user: User, classId: string) {
  const cls = await prisma.courseClass.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found");
  const isStaffManager = can(user.role, "clashes.manage") || user.role === "ADMIN";
  if (cls.facultyId !== user.id && !isStaffManager) throw new Error("Not your class");

  const assessments = await prisma.assessment.findMany({
    where: { classId },
    include: { scores: true },
  });
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    select: { studentId: true },
  });

  const totalMax = assessments.reduce((sum, a) => sum + a.maxMarks, 0);
  if (totalMax === 0) throw new Error("No assessments to publish");

  let published = 0;
  for (const e of enrollments) {
    const scored = assessments.reduce(
      (sum, a) => sum + (a.scores.find((s) => s.studentId === e.studentId)?.marks ?? 0),
      0,
    );
    const pct = Math.round((scored / totalMax) * 100);
    const [grade, points] = gradeFor(pct);
    await prisma.courseResult.upsert({
      where: { studentId_classId: { studentId: e.studentId, classId } },
      update: {
        totalMarks: pct,
        grade,
        gradePoints: points,
        published: true,
        publishedAt: new Date(),
        publishedById: user.id,
      },
      create: {
        studentId: e.studentId,
        classId,
        totalMarks: pct,
        grade,
        gradePoints: points,
        published: true,
        publishedAt: new Date(),
        publishedById: user.id,
      },
    });
    published++;
  }

  // Notify every student whose result just went live.
  for (const e of enrollments) {
    await notifyUser(e.studentId, {
      type: "SYSTEM",
      title: `Result published — ${cls.courseCode}`,
      body: `Your result for ${cls.courseCode} (${cls.title}) has been published. Open Marks & GPA to view it.`,
      link: "/marks",
    });
  }

  await recordAudit({
    actorId: user.id,
    action: "results.publish",
    entity: "CourseClass",
    entityId: classId,
    summary: `Results published for ${cls.courseCode} (${published} students)`,
    meta: { class: cls.courseCode, students: published },
  });
  return { published };
}
