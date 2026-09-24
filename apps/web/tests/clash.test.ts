import { describe, expect, it } from "vitest";
import { detectAllClashes, detectExamClashes, detectSlotClashes, overlaps } from "@/server/clash";
import type { ExamLike, SlotLike } from "@/server/clash";

const slot = (over: Partial<SlotLike> & Pick<SlotLike, "id" | "classId" | "day" | "startMin" | "endMin">): SlotLike => ({
  courseCode: "CS-000",
  section: "A",
  semester: "Fall 2026",
  ...over,
});

describe("overlaps()", () => {
  it("is false for touching ranges", () => {
    expect(overlaps(600, 660, 660, 720)).toBe(false);
  });
  it("is true for partial overlap", () => {
    expect(overlaps(600, 690, 630, 750)).toBe(true);
  });
  it("is true for containment", () => {
    expect(overlaps(540, 780, 600, 660)).toBe(true);
  });
  it("is false for disjoint ranges", () => {
    expect(overlaps(540, 600, 660, 720)).toBe(false);
  });
});

describe("detectSlotClashes()", () => {
  it("finds the seeded room clash (CS-305 vs CS-401, Lab 3, Monday)", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", courseCode: "CS-305", day: "MON", startMin: 600, endMin: 690, labId: "lab-3", room: "Lab 3" }),
      slot({ id: "s2", classId: "c2", courseCode: "CS-401", day: "MON", startMin: 630, endMin: 750, labId: "lab-3", room: "Lab 3" }),
    ];
    const clashes = detectSlotClashes(slots);
    expect(clashes.some((c) => c.kind === "lab")).toBe(true);
  });

  it("finds same-room clashes on the same day", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "TUE", startMin: 540, endMin: 660, room: "A-201" }),
      slot({ id: "s2", classId: "c2", day: "TUE", startMin: 600, endMin: 720, room: "A-201" }),
    ];
    const clashes = detectSlotClashes(slots);
    expect(clashes.filter((c) => c.kind === "room")).toHaveLength(1);
  });

  it("ignores the same room on different days", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "TUE", startMin: 540, endMin: 660, room: "A-201" }),
      slot({ id: "s2", classId: "c2", day: "WED", startMin: 540, endMin: 660, room: "A-201" }),
    ];
    expect(detectSlotClashes(slots)).toHaveLength(0);
  });

  it("ignores back-to-back slots (touching edges)", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "TUE", startMin: 540, endMin: 660, room: "A-201" }),
      slot({ id: "s2", classId: "c2", day: "TUE", startMin: 660, endMin: 780, room: "A-201" }),
    ];
    expect(detectSlotClashes(slots)).toHaveLength(0);
  });

  it("finds faculty clashes even in different rooms", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "THU", startMin: 540, endMin: 660, room: "A-101", facultyId: "f1" }),
      slot({ id: "s2", classId: "c2", day: "THU", startMin: 600, endMin: 720, room: "B-202", facultyId: "f1" }),
    ];
    const clashes = detectSlotClashes(slots);
    expect(clashes.filter((c) => c.kind === "faculty")).toHaveLength(1);
  });

  it("finds cohort overlaps for the same section+semester", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "FRI", startMin: 540, endMin: 660, section: "B", semester: "Fall 2026" }),
      slot({ id: "s2", classId: "c2", day: "FRI", startMin: 600, endMin: 720, section: "B", semester: "Fall 2026" }),
    ];
    const clashes = detectSlotClashes(slots);
    expect(clashes.filter((c) => c.kind === "cohort")).toHaveLength(1);
  });

  it("does not compare slots of the same class with themselves", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "MON", startMin: 540, endMin: 660, room: "A-1" }),
      slot({ id: "s2", classId: "c1", day: "MON", startMin: 600, endMin: 720, room: "A-1" }),
    ];
    expect(detectSlotClashes(slots)).toHaveLength(0);
  });

  it("is deterministic (stable order for identical inputs)", () => {
    const slots = [
      slot({ id: "s2", classId: "c2", day: "TUE", startMin: 600, endMin: 720, room: "A-201" }),
      slot({ id: "s1", classId: "c1", day: "TUE", startMin: 540, endMin: 660, room: "A-201" }),
    ];
    expect(JSON.stringify(detectSlotClashes(slots))).toBe(
      JSON.stringify(detectSlotClashes([...slots].reverse())),
    );
  });
});

describe("detectExamClashes()", () => {
  const exam = (over: Partial<ExamLike> & Pick<ExamLike, "id" | "courseTitle" | "date" | "startMin" | "endMin">): ExamLike => ({
    hall: "Hall A",
    ...over,
  });

  it("finds hall double-booking on the same day+time", () => {
    const exams = [
      exam({ id: "e1", courseTitle: "DSA", date: "2026-12-15", startMin: 540, endMin: 660, hall: "Hall A" }),
      exam({ id: "e2", courseTitle: "OS", date: "2026-12-15", startMin: 600, endMin: 720, hall: "Hall A" }),
    ];
    const clashes = detectExamClashes(exams, []);
    expect(clashes.filter((c) => c.kind === "exam-hall")).toHaveLength(1);
  });

  it("finds same-cohort exam overlaps", () => {
    const exams = [
      exam({ id: "e1", courseTitle: "DSA", date: "2026-12-15", startMin: 540, endMin: 660, hall: "Hall A", section: "A" }),
      exam({ id: "e2", courseTitle: "OS", date: "2026-12-15", startMin: 600, endMin: 720, hall: "Hall B", section: "A" }),
    ];
    const clashes = detectExamClashes(exams, []);
    expect(clashes.filter((c) => c.kind === "exam-cohort")).toHaveLength(1);
  });

  it("finds exam-vs-class overlaps on the matching weekday", () => {
    // 2026-12-15 is a Tuesday.
    const exams = [exam({ id: "e1", courseTitle: "DSA", date: "2026-12-15", startMin: 540, endMin: 660 })];
    const slots = [slot({ id: "s1", classId: "c9", day: "TUE", startMin: 600, endMin: 720 })];
    const clashes = detectExamClashes(exams, slots);
    expect(clashes.filter((c) => c.kind === "exam-vs-class")).toHaveLength(1);
  });

  it("ignores exams that only touch class edges", () => {
    const exams = [exam({ id: "e1", courseTitle: "DSA", date: "2026-12-15", startMin: 540, endMin: 660 })];
    const slots = [slot({ id: "s1", classId: "c9", day: "TUE", startMin: 660, endMin: 780 })];
    expect(detectExamClashes(exams, slots).filter((c) => c.kind === "exam-vs-class")).toHaveLength(0);
  });

  it("detectAllClashes merges both passes", () => {
    const slots = [
      slot({ id: "s1", classId: "c1", day: "TUE", startMin: 540, endMin: 660, room: "A-201" }),
      slot({ id: "s2", classId: "c2", day: "TUE", startMin: 600, endMin: 720, room: "A-201" }),
    ];
    const exams = [
      exam({ id: "e1", courseTitle: "DSA", date: "2026-12-15", startMin: 540, endMin: 660 }),
    ];
    const all = detectAllClashes(slots, exams);
    expect(all.some((c) => c.kind === "room")).toBe(true);
    expect(all.some((c) => c.kind === "exam-vs-class")).toBe(true);
  });
});
