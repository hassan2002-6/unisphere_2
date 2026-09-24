/**
 * Timetable / exam clash detection (plan component C4).
 * Pure, deterministic, unit-tested. Room + faculty + lab + cohort overlaps
 * for timetable slots; exam-vs-class + exam hall + exam cohort overlaps.
 */

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export type SlotLike = {
  id: string;
  classId: string;
  day: Day;
  startMin: number;
  endMin: number;
  room?: string | null;
  labId?: string | null;
  facultyId?: string | null;
  courseCode?: string;
  section?: string;
  semester?: string;
};

export type ExamLike = {
  id: string;
  classId?: string | null;
  courseTitle: string;
  /** ISO date (YYYY-MM-DD or full ISO — only the first 10 chars matter). */
  date: string;
  startMin: number;
  endMin: number;
  hall?: string | null;
  /** Section/cohort of the class (if linked). */
  section?: string | null;
  facultyId?: string | null;
};

export type ClashKind =
  | "room"
  | "lab"
  | "faculty"
  | "cohort"
  | "exam-vs-class"
  | "exam-hall"
  | "exam-cohort";

export type Clash = {
  kind: ClashKind;
  a: { id: string; label: string };
  b: { id: string; label: string };
  day?: Day;
  date?: string;
  startMin: number;
  endMin: number;
  detail: string;
};

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const dayIndex: Record<Day, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5 };

export function isoDay(dateIso: string): string {
  return dateIso.slice(0, 10);
}

function toDay(dateIso: string): Day {
  const d = new Date(`${isoDay(dateIso)}T00:00:00Z`);
  const names: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const idx = (d.getUTCDay() + 6) % 7; // Monday=0 … Sunday=6
  return names[Math.min(idx, 5)];
}

function slotLabel(s: SlotLike): string {
  return `${s.courseCode ?? s.classId}${s.section ? ` (${s.section})` : ""}`;
}

function examLabel(e: ExamLike): string {
  return `${e.courseTitle} exam`;
}

/** Slot-vs-slot clashes: rooms, labs, faculty, same-cohort overlaps. */
export function detectSlotClashes(slots: SlotLike[]): Clash[] {
  const clashes: Clash[] = [];
  const sorted = [...slots].sort(
    (a, b) =>
      dayIndex[a.day] - dayIndex[b.day] || a.startMin - b.startMin || a.id.localeCompare(b.id),
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.classId === b.classId) continue;
      if (a.day !== b.day) continue;
      if (!overlaps(a.startMin, a.endMin, b.startMin, b.endMin)) continue;

      if (a.room && b.room && a.room === b.room && !a.labId && !b.labId) {
        clashes.push({
          kind: "room",
          a: { id: a.id, label: slotLabel(a) },
          b: { id: b.id, label: slotLabel(b) },
          day: a.day,
          startMin: Math.max(a.startMin, b.startMin),
          endMin: Math.min(a.endMin, b.endMin),
          detail: `Room ${a.room} double-booked`,
        });
      }
      if (a.labId && b.labId && a.labId === b.labId) {
        clashes.push({
          kind: "lab",
          a: { id: a.id, label: slotLabel(a) },
          b: { id: b.id, label: slotLabel(b) },
          day: a.day,
          startMin: Math.max(a.startMin, b.startMin),
          endMin: Math.min(a.endMin, b.endMin),
          detail: `Lab double-booked`,
        });
      }
      if (a.facultyId && b.facultyId && a.facultyId === b.facultyId) {
        clashes.push({
          kind: "faculty",
          a: { id: a.id, label: slotLabel(a) },
          b: { id: b.id, label: slotLabel(b) },
          day: a.day,
          startMin: Math.max(a.startMin, b.startMin),
          endMin: Math.min(a.endMin, b.endMin),
          detail: `Faculty teaching two classes at once`,
        });
      }
      if (a.section && b.section && a.section === b.section && a.semester === b.semester) {
        clashes.push({
          kind: "cohort",
          a: { id: a.id, label: slotLabel(a) },
          b: { id: b.id, label: slotLabel(b) },
          day: a.day,
          startMin: Math.max(a.startMin, b.startMin),
          endMin: Math.min(a.endMin, b.endMin),
          detail: `Section ${a.section} has two classes at once`,
        });
      }
    }
  }
  return clashes;
}

/** Exam clashes: same day/time for the same cohort, same hall, exam-vs-class. */
export function detectExamClashes(exams: ExamLike[], slots: SlotLike[]): Clash[] {
  const clashes: Clash[] = [];
  const sortedExams = [...exams].sort(
    (a, b) =>
      isoDay(a.date).localeCompare(isoDay(b.date)) ||
      a.startMin - b.startMin ||
      a.id.localeCompare(b.id),
  );

  for (let i = 0; i < sortedExams.length; i++) {
    for (let j = i + 1; j < sortedExams.length; j++) {
      const a = sortedExams[i];
      const b = sortedExams[j];
      if (isoDay(a.date) !== isoDay(b.date)) continue;
      if (!overlaps(a.startMin, a.endMin, b.startMin, b.endMin)) continue;

      if (a.hall && b.hall && a.hall === b.hall) {
        clashes.push({
          kind: "exam-hall",
          a: { id: a.id, label: examLabel(a) },
          b: { id: b.id, label: examLabel(b) },
          date: isoDay(a.date),
          startMin: Math.max(a.startMin, b.startMin),
          endMin: Math.min(a.endMin, b.endMin),
          detail: `Hall ${a.hall} double-booked`,
        });
      }
      if (a.section && b.section && a.section === b.section) {
        clashes.push({
          kind: "exam-cohort",
          a: { id: a.id, label: examLabel(a) },
          b: { id: b.id, label: examLabel(b) },
          date: isoDay(a.date),
          startMin: Math.max(a.startMin, b.startMin),
          endMin: Math.min(a.endMin, b.endMin),
          detail: `Section ${a.section} has two exams at once`,
        });
      }
    }
  }

  for (const exam of sortedExams) {
    const examDay = toDay(exam.date);
    for (const slot of slots) {
      if (exam.classId && slot.classId === exam.classId) continue; // its own class
      if (slot.day !== examDay) continue;
      if (!overlaps(exam.startMin, exam.endMin, slot.startMin, slot.endMin)) continue;
      if (exam.section && slot.section && exam.section !== slot.section) continue;
      clashes.push({
        kind: "exam-vs-class",
        a: { id: exam.id, label: examLabel(exam) },
        b: { id: slot.id, label: slotLabel(slot) },
        date: isoDay(exam.date),
        day: examDay,
        startMin: Math.max(exam.startMin, slot.startMin),
        endMin: Math.min(exam.endMin, slot.endMin),
        detail: `${examLabel(exam)} overlaps scheduled class ${slotLabel(slot)}`,
      });
    }
  }
  return clashes;
}

export function detectAllClashes(slots: SlotLike[], exams: ExamLike[]): Clash[] {
  return [...detectSlotClashes(slots), ...detectExamClashes(exams, slots)];
}
