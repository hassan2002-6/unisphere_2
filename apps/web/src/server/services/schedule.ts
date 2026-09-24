import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import {
  detectAllClashes,
  type Clash,
  type ExamLike,
  type SlotLike,
} from "@/server/clash";

/**
 * Schedule reads + clash computation (plan C4/M2a). All queries are scoped by
 * the caller's role: students see their section, faculty their own classes,
 * coordinator/FYP-Head everything.
 */

export type ClassWithSchedule = Awaited<ReturnType<typeof getClassesFor>>[number];

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function studentScopeWhere(user: User, profileSection: string | null) {
  const where: { section?: string; department?: string } = {};
  if (profileSection) where.section = profileSection;
  if (user.department) where.department = user.department;
  return where;
}

export async function getClassesFor(user: User) {
  const include = {
    faculty: { select: { id: true, name: true } },
    slots: { orderBy: [{ day: "asc" as const }, { startMin: "asc" as const }] },
    exams: { orderBy: { date: "asc" as const } },
  };

  switch (user.role) {
    case "STUDENT": {
      const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
      return prisma.courseClass.findMany({
        where: studentScopeWhere(user, profile?.section ?? null),
        include,
        orderBy: { courseCode: "asc" },
      });
    }
    case "FACULTY":
      return prisma.courseClass.findMany({
        where: { facultyId: user.id },
        include,
        orderBy: { courseCode: "asc" },
      });
    default:
      return prisma.courseClass.findMany({ include, orderBy: { courseCode: "asc" } });
  }
}

export async function getScheduleData(user: User) {
  const classes = await getClassesFor(user);

  const slots: SlotLike[] = classes.flatMap((c) =>
    c.slots.map((s) => ({
      id: s.id,
      classId: c.id,
      day: s.day,
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

  return { classes, slots, exams, clashes: detectAllClashes(slots, exams) };
}

export function clashKey(c: Pick<Clash, "kind" | "a" | "b">): string {
  const [first, second] = [c.a.id, c.b.id].sort();
  return `${c.kind}:${first}:${second}`;
}

export type ClashReport = {
  active: (Clash & { key: string })[];
  resolved: { clash: Clash & { key: string }; note: string | null; resolvedAt: Date; resolvedBy: string }[];
};

/** Full clash view for the coordinator (all classes, all exams). */
export async function getClashReport(): Promise<ClashReport> {
  const classes = await prisma.courseClass.findMany({
    include: { faculty: { select: { id: true, name: true } }, slots: true, exams: true },
  });

  const slots: SlotLike[] = classes.flatMap((c) =>
    c.slots.map((s) => ({
      id: s.id,
      classId: c.id,
      day: s.day,
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

  const clashes = detectAllClashes(slots, exams).map((c) => ({ ...c, key: clashKey(c) }));
  const resolutions = await prisma.clashResolution.findMany({
    where: { key: { in: clashes.map((c) => c.key) } },
    include: { resolvedBy: { select: { name: true } } },
  });
  const resolutionByKey = new Map(resolutions.map((r) => [r.key, r]));

  const active: ClashReport["active"] = [];
  const resolved: ClashReport["resolved"] = [];
  for (const clash of clashes) {
    const r = resolutionByKey.get(clash.key);
    if (r) {
      resolved.push({ clash, note: r.note, resolvedAt: r.resolvedAt, resolvedBy: r.resolvedBy.name });
    } else {
      active.push(clash);
    }
  }
  return { active, resolved };
}

// ── formatting helpers shared by the views ─────────────────────────────
export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDay(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

export { DAYS };
