import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { detectExamClashes, detectSlotClashes, type Clash, type ExamLike, type SlotLike } from "@/server/clash";
import { getClassesFor, getClashReport, minToLabel } from "./schedule";
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
 *
 * Hardening goal §11 wraps every publish in ONE transaction that also:
 *   - writes a TimetableRevision row (before/after slot snapshot + label + note),
 *   - notifies the class faculty and every enrolled student exactly once —
 *     students always get a single “Timetable updated” message per change,
 *   - lands in the audit log after the commit.
 * The coordinator can preview a change's impact before saving, browse the
 * revision history and revert (one click) — a revert is itself a revision and
 * notifies the affected courses.
 */

export const MANAGER_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type ManagerDay = (typeof MANAGER_DAYS)[number];

/** Teaching window the portal enforces (08:00 – 20:00). */
export const WINDOW_START = 8 * 60;
export const WINDOW_END = 20 * 60;

export function isManagerDay(value: string): value is ManagerDay {
  return (MANAGER_DAYS as readonly string[]).includes(value);
}

const DAY_TITLES: Record<string, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
};

/** "MON" → "Mon" (falls back to the raw value for unknown days). */
export function dayTitle(day: string): string {
  return DAY_TITLES[day] ?? day;
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
  faculty: Awaited<ReturnType<typeof listFacultyOptions>>;
}> {
  const classes = await listManagerClasses();
  const faculty = await listFacultyOptions();

  const report = await getClashReport();
  const rooms = [...new Set(classes.flatMap((c) => c.slots.map((s) => s.room)).filter((r): r is string => Boolean(r)))].sort();

  return { classes, clashes: report.active, rooms, faculty };
}

// ── Revisions (goal §11): snapshots, labels, notices, alternatives ───────

export type TimetableChangeKind = "create" | "update" | "delete";

/** Compact slot shape stored inside a revision snapshot (small by design). */
export type RevisionSlot = {
  id: string;
  classId: string;
  courseCode: string;
  title: string;
  facultyId: string | null;
  room: string | null;
  day: string;
  /** Minutes since midnight. */
  start: number;
  /** Minutes since midnight. */
  end: number;
  section: string;
};

export type RevisionSnapshot = {
  classIds: string[];
  before: RevisionSlot[];
  after: RevisionSlot[];
};

export type RevisionSlotDiff = {
  added: RevisionSlot[];
  removed: RevisionSlot[];
  updated: { before: RevisionSlot; after: RevisionSlot }[];
};

/** Map a persisted slot + its class into the compact snapshot shape. */
export function toRevisionSlot(
  slot: { id: string; day: string; startMin: number; endMin: number; room: string | null },
  cls: { id: string; courseCode: string; title: string; facultyId: string | null; section: string },
): RevisionSlot {
  return {
    id: slot.id,
    classId: cls.id,
    courseCode: cls.courseCode,
    title: cls.title,
    facultyId: cls.facultyId,
    room: slot.room,
    day: slot.day,
    start: slot.startMin,
    end: slot.endMin,
    section: cls.section,
  };
}

const DAY_ORDER: Record<string, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
};

/** Deterministic (day, start, id) order — snapshots must be comparable. */
export function sortRevisionSlots(slots: readonly RevisionSlot[]): RevisionSlot[] {
  return [...slots].sort(
    (a, b) => (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99) || a.start - b.start || a.id.localeCompare(b.id),
  );
}

/** What changed between two slot snapshots (id-keyed; deterministic order). */
export function diffRevisionSlots(before: readonly RevisionSlot[], after: readonly RevisionSlot[]): RevisionSlotDiff {
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const afterById = new Map(after.map((s) => [s.id, s]));
  const added = after.filter((s) => !beforeById.has(s.id));
  const removed = before.filter((s) => !afterById.has(s.id));
  const updated: RevisionSlotDiff["updated"] = [];
  for (const next of after) {
    const prev = beforeById.get(next.id);
    if (!prev) continue;
    if (prev.day !== next.day || prev.start !== next.start || prev.end !== next.end || prev.room !== next.room) {
      updated.push({ before: prev, after: next });
    }
  }
  return { added, removed, updated };
}

/** 'Update CS-301 — moved to Mon 10:00' (goal §11 wording). */
export function buildRevisionLabel(kind: TimetableChangeKind, courseCode: string, day: string, startMin: number): string {
  const when = `${dayTitle(day)} ${minToLabel(startMin)}`;
  switch (kind) {
    case "create":
      return `Add ${courseCode} — ${when}`;
    case "update":
      return `Update ${courseCode} — moved to ${when}`;
    case "delete":
      return `Delete ${courseCode} — ${when}`;
  }
}

export function buildRevertLabel(label: string): string {
  return `Revert to ${label}`;
}

export type NoticeTarget = { courseCode: string; title: string; section: string };
export type NoticeSlot = { day: string; startMin: number; endMin: number; room?: string | null };

export type TimetableNotice = { title: string; body: string };

/**
 * The ONE student-facing message per publish (grouped per course change):
 * "Timetable updated" naming the course and its new time.
 */
export function buildTimetableUpdateNotice(kind: TimetableChangeKind, target: NoticeTarget, slot: NoticeSlot): TimetableNotice {
  const when = `${dayTitle(slot.day)} ${minToLabel(slot.startMin)}–${minToLabel(slot.endMin)}${slot.room ? ` in ${slot.room}` : ""}`;
  const base = `${target.courseCode} ${target.title} (Section ${target.section})`;
  const body =
    kind === "create"
      ? `${base} — new session ${when}.`
      : kind === "update"
        ? `${base} — moved to ${when}.`
        : `${base} — the ${when} session was cancelled.`;
  return { title: "Timetable updated", body };
}

export function buildTimetableRevertNotice(target: NoticeTarget, revertedLabel: string): TimetableNotice {
  return {
    title: "Timetable updated",
    body: `${target.courseCode} ${target.title} (Section ${target.section}) — the timetable was reverted to “${revertedLabel}”.`,
  };
}

export type AlternativeSlot = { day: ManagerDay; start: number; end: number; room: string | null };

/**
 * First `limit` non-conflicting candidates, de-duplicated — the pure tail of
 * the alternatives search (the caller supplies the conflict predicate).
 */
export function pickFreeAlternatives(
  candidates: readonly AlternativeSlot[],
  isFree: (candidate: AlternativeSlot) => boolean,
  limit = 5,
): AlternativeSlot[] {
  const picked: AlternativeSlot[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    const key = `${candidate.day}:${candidate.start}:${candidate.end}:${candidate.room ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isFree(candidate)) picked.push(candidate);
  }
  return picked;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseRevisionSlot(value: unknown): RevisionSlot | null {
  const v = asRecord(value);
  if (!v) return null;
  if (typeof v.id !== "string" || typeof v.classId !== "string" || typeof v.day !== "string") return null;
  if (typeof v.start !== "number" || !Number.isFinite(v.start)) return null;
  if (typeof v.end !== "number" || !Number.isFinite(v.end)) return null;
  return {
    id: v.id,
    classId: v.classId,
    courseCode: typeof v.courseCode === "string" ? v.courseCode : "",
    title: typeof v.title === "string" ? v.title : "",
    facultyId: typeof v.facultyId === "string" ? v.facultyId : null,
    room: typeof v.room === "string" ? v.room : null,
    day: v.day,
    start: v.start,
    end: v.end,
    section: typeof v.section === "string" ? v.section : "",
  };
}

/** Defensive parse of a stored snapshot — returns null for anything malformed. */
export function parseRevisionSnapshot(snapshot: unknown): RevisionSnapshot | null {
  const obj = asRecord(snapshot);
  if (!obj) return null;
  const before = (Array.isArray(obj.before) ? obj.before : []).map(parseRevisionSlot).filter((s): s is RevisionSlot => s !== null);
  const after = (Array.isArray(obj.after) ? obj.after : []).map(parseRevisionSlot).filter((s): s is RevisionSlot => s !== null);
  const explicit = (Array.isArray(obj.classIds) ? obj.classIds : []).filter((id): id is string => typeof id === "string");
  const derived = [...new Set([...before, ...after].map((s) => s.classId))];
  return { classIds: explicit.length > 0 ? explicit : derived, before: sortRevisionSlots(before), after: sortRevisionSlots(after) };
}

/** Class ids a stored snapshot touched (works even for unparsable extras). */
export function revisionClassIds(snapshot: unknown): string[] {
  return parseRevisionSnapshot(snapshot)?.classIds ?? [];
}

/** Newest revision date that touched any of `classIds` (for the student badge). */
export function latestRevisionTouching(
  revisions: readonly { createdAt: Date; snapshot: unknown }[],
  classIds: readonly string[],
): Date | null {
  const wanted = new Set(classIds);
  let latest: Date | null = null;
  for (const revision of revisions) {
    if (!revisionClassIds(revision.snapshot).some((id) => wanted.has(id))) continue;
    if (!latest || revision.createdAt.getTime() > latest.getTime()) latest = revision.createdAt;
  }
  return latest;
}

const MONTH_TITLES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 'Updated 12 Oct 2026' — deterministic (UTC), safe for server render. */
export function formatUpdatedBadge(date: Date): string {
  return `Updated ${date.getUTCDate()} ${MONTH_TITLES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** How far back the student “Updated …” badge looks. */
export const TIMETABLE_FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ── Slot writes (transactional: slot + revision + notifications) ─────────

export type SaveSlotInput = {
  id?: string;
  classId: string;
  day: string;
  startMin: number;
  endMin: number;
  room?: string | null;
};

/** Validates a slot edit and returns the narrowed teaching day. */
function assertSlotInput(input: { day: string; startMin: number; endMin: number }): { day: ManagerDay } {
  if (!isManagerDay(input.day)) throw new ServiceError("validation_error", "Pick a teaching day", 422);
  if (!Number.isInteger(input.startMin) || !Number.isInteger(input.endMin) || input.startMin >= input.endMin) {
    throw new ServiceError("validation_error", "Start time must be before end time", 422);
  }
  if (input.startMin < WINDOW_START || input.endMin > WINDOW_END) {
    throw new ServiceError("validation_error", "Teaching hours are 08:00 – 20:00", 422);
  }
  return { day: input.day };
}

function assertTimetableManager(user: User) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to edit the timetable", 403);
  }
}

export async function saveSlot(user: User, input: SaveSlotInput, note?: string | null) {
  assertTimetableManager(user);
  const { day } = assertSlotInput(input);

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
    day,
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

  const kind: TimetableChangeKind = input.id ? "update" : "create";
  const data = {
    classId: cls.id,
    day,
    startMin: input.startMin,
    endMin: input.endMin,
    room: candidate.room,
  };

  // One transaction: the slot write, its revision row and every notification
  // commit together (goal §11) — a failed notification never leaves a silent
  // timetable change behind.
  const { saved } = await prisma.$transaction(async (tx) => {
    const before = sortRevisionSlots(
      (await tx.timetableSlot.findMany({ where: { classId: cls.id } })).map((s) => toRevisionSlot(s, cls)),
    );
    const saved = input.id
      ? await tx.timetableSlot.update({ where: { id: input.id }, data })
      : await tx.timetableSlot.create({ data });
    const after = sortRevisionSlots(
      (await tx.timetableSlot.findMany({ where: { classId: cls.id } })).map((s) => toRevisionSlot(s, cls)),
    );

    await tx.timetableRevision.create({
      data: {
        actorId: user.id,
        label: buildRevisionLabel(kind, cls.courseCode, input.day, input.startMin),
        note: note?.trim() || null,
        snapshot: { classIds: [cls.id], before, after },
      },
    });

    // Tell the people whose week just changed: the class faculty once, and
    // every enrolled student exactly once per change — nobody else.
    if (cls.facultyId) {
      const when = `${input.day} ${minToLabel(input.startMin)}–${minToLabel(input.endMin)}${candidate.room ? ` in ${candidate.room}` : ""}`;
      await notifyUser(
        cls.facultyId,
        {
          type: "ANNOUNCEMENT",
          title: kind === "create" ? "New session scheduled" : "Timetable updated",
          body: `${cls.courseCode} ${cls.title} (Section ${cls.section}) — ${when}.`,
          link: "/timetable",
        },
        tx,
      );
    }
    const notice = buildTimetableUpdateNotice(kind, cls, {
      day: input.day,
      startMin: input.startMin,
      endMin: input.endMin,
      room: candidate.room,
    });
    const enrolled = await tx.enrollment.findMany({
      where: { classId: cls.id, status: "ACTIVE" },
      select: { studentId: true },
    });
    for (const e of enrolled) {
      await notifyUser(e.studentId, { type: "ANNOUNCEMENT", ...notice, link: "/timetable" }, tx);
    }
    return { saved };
  });

  await recordAudit({
    actorId: user.id,
    action: input.id ? "timetable.slot_update" : "timetable.slot_create",
    entity: "TimetableSlot",
    entityId: saved.id,
    summary: `${cls.courseCode} ${cls.section}: ${input.day} ${minToLabel(input.startMin)}–${minToLabel(input.endMin)}${candidate.room ? ` in ${candidate.room}` : ""}`,
  });

  return { saved, warnings: involved.filter((c) => c.kind !== "room") };
}

export async function deleteSlot(user: User, id: string, note?: string | null) {
  assertTimetableManager(user);
  const slot = await prisma.timetableSlot.findUnique({
    where: { id },
    include: { class: { include: { faculty: { select: { id: true } } } } },
  });
  if (!slot) throw new ServiceError("not_found", "Session not found", 404);

  const cls = slot.class;

  await prisma.$transaction(async (tx) => {
    const before = sortRevisionSlots(
      (await tx.timetableSlot.findMany({ where: { classId: cls.id } })).map((s) => toRevisionSlot(s, cls)),
    );
    await tx.timetableSlot.delete({ where: { id } });
    const after = sortRevisionSlots(
      (await tx.timetableSlot.findMany({ where: { classId: cls.id } })).map((s) => toRevisionSlot(s, cls)),
    );

    await tx.timetableRevision.create({
      data: {
        actorId: user.id,
        label: buildRevisionLabel("delete", cls.courseCode, slot.day, slot.startMin),
        note: note?.trim() || null,
        snapshot: { classIds: [cls.id], before, after },
      },
    });

    if (cls.facultyId) {
      await notifyUser(
        cls.facultyId,
        {
          type: "ANNOUNCEMENT",
          title: "Session cancelled",
          body: `${cls.courseCode} ${cls.title} (Section ${cls.section}) — the ${slot.day} session was cancelled.`,
          link: "/timetable",
        },
        tx,
      );
    }
    const notice = buildTimetableUpdateNotice("delete", cls, {
      day: slot.day,
      startMin: slot.startMin,
      endMin: slot.endMin,
      room: slot.room,
    });
    const enrolled = await tx.enrollment.findMany({
      where: { classId: cls.id, status: "ACTIVE" },
      select: { studentId: true },
    });
    for (const e of enrolled) {
      await notifyUser(e.studentId, { type: "ANNOUNCEMENT", ...notice, link: "/timetable" }, tx);
    }
  });

  await recordAudit({
    actorId: user.id,
    action: "timetable.slot_delete",
    entity: "TimetableSlot",
    entityId: id,
    summary: `${cls.courseCode} ${cls.section}: ${slot.day} session removed`,
  });
}

// ── Impact preview (goal §11): conflicts, students, free alternatives ────

export type PreviewConflictKind = "student" | "faculty" | "room" | "exam";
export type PreviewConflict = { kind: PreviewConflictKind; detail: string; with: string };

export type SlotPreview = {
  conflicts: PreviewConflict[];
  affectedStudents: { count: number; sample: string[] };
  alternatives: AlternativeSlot[];
};

const PREVIEW_KIND: Partial<Record<Clash["kind"], PreviewConflictKind>> = {
  room: "room",
  lab: "room",
  faculty: "faculty",
  cohort: "student",
  "exam-vs-class": "exam",
};

function slotSideLabel(slots: readonly SlotLike[], id: string): string {
  const s = slots.find((x) => x.id === id);
  if (!s) return "another session";
  const course = `${s.courseCode ?? "Session"}${s.section ? ` (${s.section})` : ""}`;
  return `${course} · ${dayTitle(s.day)} ${minToLabel(s.startMin)}–${minToLabel(s.endMin)}${s.room ? ` · ${s.room}` : ""}`;
}

function buildAlternativeCandidates(proposed: SlotLike): AlternativeSlot[] {
  const duration = proposed.endMin - proposed.startMin;
  const days: ManagerDay[] = [proposed.day, ...MANAGER_DAYS.filter((d) => d !== proposed.day)];
  const candidates: AlternativeSlot[] = [];
  for (const day of days) {
    for (let start = WINDOW_START; start + duration <= WINDOW_END; start += 30) {
      if (day === proposed.day && start === proposed.startMin) continue; // that's the proposal itself
      candidates.push({ day, start, end: start + duration, room: proposed.room ?? null });
    }
  }
  return candidates;
}

/**
 * Dry-run a slot create/update: every conflict it would take part in, who it
 * would notify, and up to five free windows that avoid hard clashes.
 */
export async function previewSlotChange(user: User, proposed: SaveSlotInput): Promise<SlotPreview> {
  assertTimetableManager(user);
  const { day } = assertSlotInput(proposed);

  const cls = await prisma.courseClass.findUnique({
    where: { id: proposed.classId },
    include: { faculty: { select: { id: true, name: true } }, slots: true },
  });
  if (!cls) throw new ServiceError("not_found", "Class not found", 404);
  if (proposed.id && !cls.slots.some((s) => s.id === proposed.id)) {
    throw new ServiceError("not_found", "That session is not part of this class", 404);
  }

  const candidate: SlotLike = {
    id: proposed.id ?? "new",
    classId: cls.id,
    day,
    startMin: proposed.startMin,
    endMin: proposed.endMin,
    room: proposed.room?.trim() || null,
    labId: null,
    facultyId: cls.facultyId,
    courseCode: cls.courseCode,
    section: cls.section,
    semester: cls.semester,
  };

  const all = toSlotLikes(await prisma.courseClass.findMany({ include: { slots: true } }));
  const others = all.filter((s) => s.id !== candidate.id);
  const merged = [candidate, ...others];

  const conflicts: PreviewConflict[] = [];
  for (const clash of detectSlotClashes(merged)) {
    if (clash.a.id !== candidate.id && clash.b.id !== candidate.id) continue;
    const kind = PREVIEW_KIND[clash.kind];
    if (!kind) continue;
    const otherId = clash.a.id === candidate.id ? clash.b.id : clash.a.id;
    conflicts.push({ kind, detail: clash.detail, with: slotSideLabel(merged, otherId) });
  }

  const classesWithExams = await prisma.courseClass.findMany({
    include: { exams: { select: { id: true, courseTitle: true, date: true, startMin: true, endMin: true, hall: true } } },
  });
  const exams: ExamLike[] = classesWithExams.flatMap((c) =>
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
  for (const clash of detectExamClashes(exams, merged)) {
    if (clash.kind !== "exam-vs-class" || clash.b.id !== candidate.id) continue;
    conflicts.push({
      kind: "exam",
      detail: clash.detail,
      with: `${clash.a.label}${clash.date ? ` on ${clash.date}` : ""}`,
    });
  }

  const enrolled = await prisma.enrollment.findMany({
    where: { classId: cls.id, status: "ACTIVE" },
    orderBy: { studentId: "asc" },
    select: { student: { select: { name: true } } },
  });

  const candidates = buildAlternativeCandidates(candidate);
  const alternatives = pickFreeAlternatives(
    candidates,
    (alt) => {
      const trial: SlotLike = { ...candidate, day: alt.day, startMin: alt.start, endMin: alt.end, room: alt.room };
      return detectSlotClashes([trial, ...others]).every((c) => c.a.id !== trial.id && c.b.id !== trial.id);
    },
    5,
  );

  return {
    conflicts,
    affectedStudents: { count: enrolled.length, sample: enrolled.slice(0, 5).map((e) => e.student.name) },
    alternatives,
  };
}

// ── History + revert (goal §11) ──────────────────────────────────────────

export async function listTimetableRevisions(user: User, take = 12) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to view the timetable history", 403);
  }
  return prisma.timetableRevision.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Math.trunc(take), 1), 50),
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}

export type TimetableRevisionRow = Awaited<ReturnType<typeof listTimetableRevisions>>[number];

export type RevertSummary = {
  /** False when the timetable already matched the revision (no write happened). */
  applied: boolean;
  /** Id of the new “Revert to …” revision (null when nothing changed). */
  revisionId: string | null;
  /** Label of the revision that was reverted to. */
  revertedTo: string;
  message: string;
  restored: { added: number; removed: number; updated: number };
};

/**
 * One-click revert: undo a revision by restoring every class it touched to
 * the state recorded in `snapshot.before` — inside a single transaction that
 * also writes a brand-new “Revert to <label>” revision and notifies the
 * affected courses (grouped: one message per student per course change).
 */
export async function revertToRevision(user: User, revisionId: string, note?: string | null): Promise<RevertSummary> {
  assertTimetableManager(user);

  const revision = await prisma.timetableRevision.findUnique({ where: { id: revisionId } });
  if (!revision) throw new ServiceError("not_found", "Revision not found", 404);

  const snapshot = parseRevisionSnapshot(revision.snapshot);
  if (!snapshot || (snapshot.before.length === 0 && snapshot.after.length === 0)) {
    throw new ServiceError("validation_error", "This revision has no restorable snapshot", 422);
  }

  const summary = await prisma.$transaction(async (tx) => {
    const classes = await tx.courseClass.findMany({ where: { id: { in: snapshot.classIds } } });
    const classById = new Map(classes.map((c) => [c.id, c]));
    const currentSlots = await tx.timetableSlot.findMany({ where: { classId: { in: snapshot.classIds } } });

    // The revert target is the state recorded BEFORE the revision — clicking
    // “Revert” on a bad publish undoes that change.
    const restoreByClass = new Map<string, RevisionSlot[]>();
    for (const slot of snapshot.before) {
      if (!classById.has(slot.classId)) continue; // class was deleted since
      const list = restoreByClass.get(slot.classId) ?? [];
      list.push(slot);
      restoreByClass.set(slot.classId, list);
    }

    type SlotOp =
      | { type: "remove"; classId: string; id: string }
      | { type: "update"; classId: string; target: RevisionSlot }
      | { type: "add"; classId: string; target: RevisionSlot };

    const ops: SlotOp[] = [];
    for (const classId of snapshot.classIds) {
      if (!classById.has(classId)) continue;
      const current = currentSlots.filter((s) => s.classId === classId);
      const target = restoreByClass.get(classId) ?? [];
      const targetIds = new Set(target.map((s) => s.id));
      const currentById = new Map(current.map((s) => [s.id, s]));
      for (const slot of current) {
        if (!targetIds.has(slot.id)) ops.push({ type: "remove", classId, id: slot.id });
      }
      for (const t of target) {
        const cur = currentById.get(t.id);
        if (!cur) {
          ops.push({ type: "add", classId, target: t });
        } else if (cur.day !== t.day || cur.startMin !== t.start || cur.endMin !== t.end || cur.room !== t.room) {
          ops.push({ type: "update", classId, target: t });
        }
      }
    }

    const counts = { added: 0, removed: 0, updated: 0 };
    for (const op of ops) {
      if (op.type === "add") counts.added += 1;
      else if (op.type === "remove") counts.removed += 1;
      else counts.updated += 1;
    }

    if (ops.length === 0) {
      return {
        applied: false,
        revisionId: null,
        revertedTo: revision.label,
        message: "Nothing to revert — the timetable already matches the state before this revision.",
        restored: counts,
      } satisfies RevertSummary;
    }

    const changedIds = [...new Set(ops.map((op) => op.classId))].sort();
    const changedSet = new Set(changedIds);
    const before = sortRevisionSlots(
      currentSlots
        .filter((s) => changedSet.has(s.classId))
        .map((s) => {
          const cls = classById.get(s.classId);
          return cls ? toRevisionSlot(s, cls) : null;
        })
        .filter((s): s is RevisionSlot => s !== null),
    );
    const restored = sortRevisionSlots(changedIds.flatMap((id) => restoreByClass.get(id) ?? []));

    for (const op of ops) {
      if (op.type === "remove") await tx.timetableSlot.delete({ where: { id: op.id } });
    }
    for (const op of ops) {
      if (op.type === "remove") continue;
      const day = op.target.day as SlotLike["day"];
      if (op.type === "update") {
        await tx.timetableSlot.update({
          where: { id: op.target.id },
          data: { day, startMin: op.target.start, endMin: op.target.end, room: op.target.room },
        });
      } else {
        await tx.timetableSlot.create({
          data: {
            id: op.target.id,
            classId: op.target.classId,
            day,
            startMin: op.target.start,
            endMin: op.target.end,
            room: op.target.room,
          },
        });
      }
    }

    const newRevision = await tx.timetableRevision.create({
      data: {
        actorId: user.id,
        label: buildRevertLabel(revision.label),
        note: note?.trim() || null,
        snapshot: { classIds: changedIds, before, after: restored },
      },
    });

    // Grouped notifications: one message per student per course change.
    const changedClasses = changedIds
      .map((id) => classById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
    for (const cls of changedClasses) {
      const notice = buildTimetableRevertNotice(cls, revision.label);
      const enrolled = await tx.enrollment.findMany({
        where: { classId: cls.id, status: "ACTIVE" },
        select: { studentId: true },
      });
      for (const e of enrolled) {
        await notifyUser(e.studentId, { type: "ANNOUNCEMENT", ...notice, link: "/timetable" }, tx);
      }
      if (cls.facultyId) {
        await notifyUser(cls.facultyId, { type: "ANNOUNCEMENT", ...notice, link: "/timetable" }, tx);
      }
    }

    const total = counts.added + counts.removed + counts.updated;
    return {
      applied: true,
      revisionId: newRevision.id,
      revertedTo: revision.label,
      message: `Reverted “${revision.label}” — ${total} session change${total === 1 ? "" : "s"} rolled back and the affected courses were notified.`,
      restored: counts,
    } satisfies RevertSummary;
  });

  if (summary.applied) {
    await recordAudit({
      actorId: user.id,
      action: "timetable.revision_revert",
      entity: "TimetableRevision",
      entityId: summary.revisionId,
      summary: summary.message,
    });
  }

  return summary;
}

/**
 * Newest date (within the last 7 days) on which a revision touched a class
 * this user actually sees — drives the student “Updated …” badge.
 */
export async function getTimetableUpdatedAtFor(user: User): Promise<Date | null> {
  if (user.role !== "STUDENT" && user.role !== "FACULTY") return null;

  const classes = await getClassesFor(user);
  if (classes.length === 0) return null;

  const revisions = await prisma.timetableRevision.findMany({
    where: { createdAt: { gte: new Date(Date.now() - TIMETABLE_FRESH_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { createdAt: true, snapshot: true },
  });

  return latestRevisionTouching(revisions, classes.map((c) => c.id));
}

/**
 * Course & section management (spec §8): the coordinator creates course
 * sections and assigns faculty to them. Assigning a faculty member whose
 * existing sessions collide with this class's sessions is blocked.
 */

export async function listFacultyOptions() {
  return prisma.user.findMany({
    where: { role: "FACULTY", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeId: true },
  });
}

export type SaveClassInput = {
  id?: string;
  courseCode: string;
  title: string;
  section: string;
  department: string;
  semester: string;
  credits?: number | null;
  facultyId?: string | null;
};

export async function saveClass(user: User, input: SaveClassInput) {
  if (!can(user.role, "timetable.manage")) {
    throw new ServiceError("forbidden", "Not permitted to manage courses", 403);
  }
  const courseCode = input.courseCode.trim().toUpperCase();
  const title = input.title.trim();
  const section = input.section.trim().toUpperCase();
  const department = input.department.trim() || "Computer Science";
  const semester = input.semester.trim();
  if (courseCode.length < 4) throw new ServiceError("validation_error", "Course code looks too short (e.g. CS-301)", 422);
  if (title.length < 3) throw new ServiceError("validation_error", "Enter the course title", 422);
  if (!section) throw new ServiceError("validation_error", "Enter the section (e.g. A)", 422);
  if (!semester) throw new ServiceError("validation_error", "Enter the semester (e.g. Spring 2026)", 422);

  if (input.facultyId) {
    const faculty = await prisma.user.findUnique({ where: { id: input.facultyId } });
    if (!faculty || faculty.role !== "FACULTY") {
      throw new ServiceError("validation_error", "Pick a faculty member for this course", 422);
    }
  }

  const data = {
    courseCode,
    title,
    section,
    department,
    semester,
    credits: input.credits ?? null,
    facultyId: input.facultyId ?? null,
  };

  const saved = input.id
    ? await prisma.courseClass.update({ where: { id: input.id }, data })
    : await prisma.courseClass.create({ data });

  // Faculty double-booking guard: pretend this class now has the candidate
  // faculty and look for faculty-kind clashes against every other class.
  if (saved.facultyId) {
    const all = await prisma.courseClass.findMany({
      include: { slots: { select: { id: true, day: true, startMin: true, endMin: true, room: true, labId: true } } },
    });
    const slots: SlotLike[] = all.flatMap((c) =>
      c.slots.map((s) => ({
        id: s.id,
        classId: c.id,
        day: s.day as SlotLike["day"],
        startMin: s.startMin,
        endMin: s.endMin,
        room: s.room,
        labId: s.labId,
        facultyId: c.id === saved.id ? saved.facultyId : c.facultyId,
        courseCode: c.courseCode,
        section: c.section,
        semester: c.semester,
      })),
    );
    const mine = new Set(all.find((c) => c.id === saved.id)?.slots.map((s) => s.id) ?? []);
    const facultyClash = detectSlotClashes(slots).find(
      (c) => c.kind === "faculty" && (mine.has(c.a.id) || mine.has(c.b.id)),
    );
    if (facultyClash) {
      // Roll the assignment back — the schedule must never double-book a teacher.
      await prisma.courseClass.update({ where: { id: saved.id }, data: { facultyId: null } });
      throw new ServiceError("conflict", `Faculty unavailable: ${facultyClash.detail}`, 409);
    }

    await notifyUser(saved.facultyId, {
      type: "ANNOUNCEMENT",
      title: input.id ? "Course assignment updated" : "New course assigned",
      body: `You are assigned to ${saved.courseCode} ${saved.title} (Section ${saved.section}, ${saved.semester}).`,
      link: "/faculty/courses",
    });
  }

  await recordAudit({
    actorId: user.id,
    action: input.id ? "course.update" : "course.create",
    entity: "CourseClass",
    entityId: saved.id,
    summary: `${saved.courseCode} ${saved.title} · Section ${saved.section} · ${saved.semester}${saved.facultyId ? " (faculty assigned)" : ""}`,
  });

  return saved;
}
