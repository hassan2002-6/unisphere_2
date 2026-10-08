import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { detectSlotClashes, type Clash, type SlotLike } from "@/server/clash";
import { getClashReport } from "./schedule";
import { ServiceError } from "./forms";
import { notifyUser } from "./notifications";
import { recordAudit } from "./audit";

/**
 * Coordinator timetable management (realism wave): the coordinator owns the
 * weekly grid of every class — they can add, move and remove sessions.
 *
 * Saves are conflict-checked against the live timetable before they land:
 *   room / faculty / cohort double-bookings are BLOCKED (hard errors),
 *   the returned `warnings` carry anything softer for the UI to surface.
 * Every write notifies the course faculty + enrolled students and lands in the
 * audit log.
 */

export const MANAGER_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type ManagerDay = (typeof MANAGER_DAYS)[number];

/** Teaching window the portal enforces (08:00 – 20:00). */
export const WINDOW_START = 8 * 60;
export const WINDOW_END = 20 * 60;

export function isManagerDay(value: string): value is ManagerDay {
  return (MANAGER_DAYS as readonly string[]).includes(value);
}

async function listManagerClasses() {
  return prisma.courseClass.findMany({
    orderBy: [{ semester: "asc" }, { courseCode: "asc" }, { section: "asc" }],
    include: {
      faculty: { select: { id: true, name: true, employeeId: true } },
      slots: { orderBy: [{ day: "asc" }, { startMin: "asc" }] },
      _count: { select: { enrollments: true } },
    },
  });
}

export type ManagerClass = Awaited<ReturnType<typeof listManagerClasses>>[number];

function toSlotLikes(
  classes: {
    id: string;
    facultyId: string | null;
    courseCode: string;
    section: string;
    semester: string;
    slots: { id: string; day: string; startMin: number; endMin: number; room: string | null; labId: string | null }[];
  }[],
): SlotLike[] {
  return classes.flatMap((c) =>
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
}

export async function getTimetableManagerData(): Promise<{
  classes: ManagerClass[];
  clashes: Clash[];
  rooms: string[];
}> {
  const classes = await listManagerClasses();

  const report = await getClashReport();
  const rooms = [...new Set(classes.flatMap((c) => c.slots.map((s) => s.room)).filter((r): r is string => Boolean(r)))].sort();

  return { classes, clashes: report.active, rooms };
}

export type SaveSlotInput = {
  id?: string;
  classId: string;
  day: string;
  startMin: number;
  endMin: number;
  room?: string | null;
};

export async function saveSlot(user: User, input: SaveSlotInput) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to edit the timetable", 403);
  }
  if (!isManagerDay(input.day)) throw new ServiceError("validation_error", "Pick a teaching day", 422);
  if (!Number.isInteger(input.startMin) || !Number.isInteger(input.endMin) || input.startMin >= input.endMin) {
    throw new ServiceError("validation_error", "Start time must be before end time", 422);
  }
  if (input.startMin < WINDOW_START || input.endMin > WINDOW_END) {
    throw new ServiceError("validation_error", "Teaching hours are 08:00 – 20:00", 422);
  }

  const cls = await prisma.courseClass.findUnique({
    where: { id: input.classId },
    include: { faculty: { select: { id: true, name: true } }, slots: true },
  });
  if (!cls) throw new ServiceError("not_found", "Class not found", 404);

  if (input.id) {
    const existing = cls.slots.find((s) => s.id === input.id);
    if (!existing) throw new ServiceError("not_found", "That session is not part of this class", 404);
  }

  const candidate: SlotLike = {
    id: input.id ?? "new",
    classId: cls.id,
    day: input.day,
    startMin: input.startMin,
    endMin: input.endMin,
    room: input.room?.trim() || null,
    labId: null,
    facultyId: cls.facultyId,
    courseCode: cls.courseCode,
    section: cls.section,
    semester: cls.semester,
  };

  // Merge the candidate into the live timetable and inspect every clash it
  // takes part in — excluding itself when editing an existing session.
  const all = toSlotLikes(await prisma.courseClass.findMany({ include: { slots: true } }));
  const others = all.filter((s) => s.id !== candidate.id);
  const involved = detectSlotClashes([candidate, ...others]).filter(
    (c) => c.a.id === candidate.id || c.b.id === candidate.id,
  );
  const hard = involved.filter((c) => c.kind === "room" || c.kind === "faculty" || c.kind === "cohort");
  if (hard.length > 0) {
    throw new ServiceError("conflict", `Blocked: ${hard[0].detail}`, 409);
  }

  const data = {
    classId: cls.id,
    day: input.day as SlotLike["day"],
    startMin: input.startMin,
    endMin: input.endMin,
    room: candidate.room,
  };
  const saved = input.id
    ? await prisma.timetableSlot.update({ where: { id: input.id }, data })
    : await prisma.timetableSlot.create({ data });

  // Tell the people whose week just changed.
  const when = `${input.day} ${String(Math.floor(input.startMin / 60)).padStart(2, "0")}:${String(input.startMin % 60).padStart(2, "0")}–${String(Math.floor(input.endMin / 60)).padStart(2, "0")}:${String(input.endMin % 60).padStart(2, "0")}${candidate.room ? ` in ${candidate.room}` : ""}`;
  const title = input.id ? "Timetable updated" : "New session scheduled";
  const body = `${cls.courseCode} ${cls.title} (Section ${cls.section}) — ${when}.`;
  if (cls.facultyId) {
    await notifyUser(cls.facultyId, { type: "ANNOUNCEMENT", title, body, link: "/timetable" });
  }
  const enrolled = await prisma.enrollment.findMany({
    where: { classId: cls.id, status: "ACTIVE" },
    select: { studentId: true },
    take: 100,
  });
  for (const e of enrolled) {
    await notifyUser(e.studentId, { type: "ANNOUNCEMENT", title, body, link: "/timetable" });
  }

  await recordAudit({
    actorId: user.id,
    action: input.id ? "timetable.slot_update" : "timetable.slot_create",
    entity: "TimetableSlot",
    entityId: saved.id,
    summary: `${cls.courseCode} ${cls.section}: ${when}`,
  });

  return { saved, warnings: involved.filter((c) => c.kind !== "room") };
}

export async function deleteSlot(user: User, id: string) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to edit the timetable", 403);
  }
  const slot = await prisma.timetableSlot.findUnique({
    where: { id },
    include: { class: { include: { faculty: { select: { id: true } } } } },
  });
  if (!slot) throw new ServiceError("not_found", "Session not found", 404);

  await prisma.timetableSlot.delete({ where: { id } });

  const body = `${slot.class.courseCode} ${slot.class.title} (Section ${slot.class.section}) — the ${slot.day} session was cancelled.`;
  if (slot.class.facultyId) {
    await notifyUser(slot.class.facultyId, { type: "ANNOUNCEMENT", title: "Session cancelled", body, link: "/timetable" });
  }
  const enrolled = await prisma.enrollment.findMany({
    where: { classId: slot.classId, status: "ACTIVE" },
    select: { studentId: true },
    take: 100,
  });
  for (const e of enrolled) {
    await notifyUser(e.studentId, { type: "ANNOUNCEMENT", title: "Session cancelled", body, link: "/timetable" });
  }

  await recordAudit({
    actorId: user.id,
    action: "timetable.slot_delete",
    entity: "TimetableSlot",
    entityId: id,
    summary: `${slot.class.courseCode} ${slot.class.section}: ${slot.day} session removed`,
  });
}
