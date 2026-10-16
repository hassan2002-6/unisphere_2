import { describe, expect, it } from "vitest";
import {
  buildRevisionLabel,
  buildRevertLabel,
  buildTimetableRevertNotice,
  buildTimetableUpdateNotice,
  diffRevisionSlots,
  formatUpdatedBadge,
  latestRevisionTouching,
  parseRevisionSnapshot,
  pickFreeAlternatives,
  revisionClassIds,
  sortRevisionSlots,
  toRevisionSlot,
} from "@/server/services/timetable-manage";
import type { AlternativeSlot, RevisionSlot } from "@/server/services/timetable-manage";

/**
 * Goal §11 hardening — the pure core of the revision system:
 *   - snapshot mapping / diffing and the human label builder,
 *   - grouped student-notification message formatting,
 *   - the free-window (alternatives) filter,
 *   - the “Updated …” badge helpers.
 */

const slot = (over: Partial<RevisionSlot> & Pick<RevisionSlot, "id" | "day" | "start" | "end">): RevisionSlot => ({
  classId: "c1",
  courseCode: "CS-301",
  title: "Data Structures",
  facultyId: "f1",
  room: "C-204",
  section: "A",
  ...over,
});

describe("toRevisionSlot() + sortRevisionSlots()", () => {
  it("maps a persisted slot + class into the compact snapshot shape", () => {
    const mapped = toRevisionSlot(
      { id: "s1", day: "MON", startMin: 600, endMin: 690, room: "C-204" },
      { id: "c1", courseCode: "CS-301", title: "Data Structures", facultyId: "f1", section: "A" },
    );
    expect(mapped).toEqual({
      id: "s1",
      classId: "c1",
      courseCode: "CS-301",
      title: "Data Structures",
      facultyId: "f1",
      room: "C-204",
      day: "MON",
      start: 600,
      end: 690,
      section: "A",
    });
  });

  it("keeps snapshots deterministic (day, start, then id)", () => {
    const sorted = sortRevisionSlots([
      slot({ id: "b", day: "TUE", start: 600, end: 660 }),
      slot({ id: "a", day: "MON", start: 540, end: 600 }),
      slot({ id: "c", day: "TUE", start: 600, end: 660 }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("diffRevisionSlots()", () => {
  it("separates added, removed and updated slots by id", () => {
    const before = [
      slot({ id: "s1", day: "MON", start: 600, end: 690 }),
      slot({ id: "s2", day: "TUE", start: 600, end: 690 }),
    ];
    const after = [
      slot({ id: "s1", day: "MON", start: 660, end: 750 }), // moved
      slot({ id: "s3", day: "WED", start: 600, end: 690 }), // added
    ];
    const diff = diffRevisionSlots(before, after);
    expect(diff.added.map((s) => s.id)).toEqual(["s3"]);
    expect(diff.removed.map((s) => s.id)).toEqual(["s2"]);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0].before.start).toBe(600);
    expect(diff.updated[0].after.start).toBe(660);
  });

  it("reports nothing for identical snapshots and ignores rich-text-only fields", () => {
    const a = [slot({ id: "s1", day: "MON", start: 600, end: 690 })];
    const b = [slot({ id: "s1", day: "MON", start: 600, end: 690, room: "C-999", title: "Renamed" })];
    expect(diffRevisionSlots(a, a)).toEqual({ added: [], removed: [], updated: [] });
    // Room changes are real changes; title/course edits are not slot changes.
    const diff = diffRevisionSlots(a, b);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0].after.room).toBe("C-999");
    const onlyTitle = [slot({ id: "s1", day: "MON", start: 600, end: 690, title: "Renamed" })];
    expect(diffRevisionSlots(a, onlyTitle).updated).toHaveLength(0);
  });
});

describe("buildRevisionLabel() + buildRevertLabel()", () => {
  it("matches the §11 example: 'Update CS-301 — moved to Mon 10:00'", () => {
    expect(buildRevisionLabel("update", "CS-301", "MON", 600)).toBe("Update CS-301 — moved to Mon 10:00");
  });

  it("labels creates and deletes with the day + start time", () => {
    expect(buildRevisionLabel("create", "CS-401", "TUE", 540)).toBe("Add CS-401 — Tue 09:00");
    expect(buildRevisionLabel("delete", "SE-310", "SAT", 11 * 60 + 30)).toBe("Delete SE-310 — Sat 11:30");
  });

  it("prefixes a revert with 'Revert to'", () => {
    expect(buildRevertLabel("Update CS-301 — moved to Mon 10:00")).toBe(
      "Revert to Update CS-301 — moved to Mon 10:00",
    );
  });
});

describe("grouped notification messages (buildTimetableUpdateNotice / buildTimetableRevertNotice)", () => {
  const target = { courseCode: "CS-301", title: "Data Structures", section: "A" };
  const when = { day: "MON", startMin: 600, endMin: 690, room: "C-204" };

  it("always uses the 'Timetable updated' title and names course + new time", () => {
    for (const kind of ["create", "update", "delete"] as const) {
      const notice = buildTimetableUpdateNotice(kind, target, when);
      expect(notice.title).toBe("Timetable updated");
      expect(notice.body).toContain("CS-301 Data Structures (Section A)");
    }
  });

  it("formats each change kind precisely", () => {
    expect(buildTimetableUpdateNotice("create", target, when).body).toBe(
      "CS-301 Data Structures (Section A) — new session Mon 10:00–11:30 in C-204.",
    );
    expect(buildTimetableUpdateNotice("update", target, when).body).toBe(
      "CS-301 Data Structures (Section A) — moved to Mon 10:00–11:30 in C-204.",
    );
    expect(buildTimetableUpdateNotice("delete", target, when).body).toBe(
      "CS-301 Data Structures (Section A) — the Mon 10:00–11:30 in C-204 session was cancelled.",
    );
  });

  it("omits the room clause when the session has no room", () => {
    const notice = buildTimetableUpdateNotice("update", target, { day: "SAT", startMin: 540, endMin: 630, room: null });
    expect(notice.body).toBe("CS-301 Data Structures (Section A) — moved to Sat 09:00–10:30.");
  });

  it("formats the revert message with the reverted-to label", () => {
    const notice = buildTimetableRevertNotice(target, "Update CS-301 — moved to Mon 10:00");
    expect(notice.title).toBe("Timetable updated");
    expect(notice.body).toBe(
      "CS-301 Data Structures (Section A) — the timetable was reverted to “Update CS-301 — moved to Mon 10:00”.",
    );
  });
});

describe("pickFreeAlternatives()", () => {
  const candidates: AlternativeSlot[] = [
    { day: "MON", start: 600, end: 690, room: "C-204" },
    { day: "MON", start: 630, end: 720, room: "C-204" },
    { day: "TUE", start: 540, end: 630, room: "C-204" },
    { day: "TUE", start: 540, end: 630, room: "C-204" }, // duplicate
    { day: "WED", start: 600, end: 690, room: "C-204" },
    { day: "THU", start: 600, end: 690, room: "C-204" },
    { day: "FRI", start: 600, end: 690, room: "C-204" },
    { day: "SAT", start: 600, end: 690, room: "C-204" },
  ];

  it("keeps only non-conflicting candidates, in order, deduplicated", () => {
    const free = pickFreeAlternatives(candidates, (c) => c.start % 60 === 0, 5);
    expect(free.map((c) => `${c.day} ${c.start}`)).toEqual([
      "MON 600",
      "TUE 540",
      "WED 600",
      "THU 600",
      "FRI 600",
    ]);
  });

  it("caps the result at the limit (default 5)", () => {
    expect(pickFreeAlternatives(candidates, () => true)).toHaveLength(5);
    expect(pickFreeAlternatives(candidates, () => true, 2)).toHaveLength(2);
  });

  it("returns nothing when every candidate conflicts", () => {
    expect(pickFreeAlternatives(candidates, () => false)).toEqual([]);
  });
});

describe("revision snapshots (parse / class ids / latest touch)", () => {
  const before = [slot({ id: "s1", day: "MON", start: 600, end: 690 })];
  const after = [slot({ id: "s1", day: "MON", start: 660, end: 750 }), slot({ id: "s2", day: "WED", start: 600, end: 690 })];
  const snapshot = { classIds: ["c1"], before, after };

  it("round-trips a well-formed snapshot (sorted, classIds preserved)", () => {
    const parsed = parseRevisionSnapshot(snapshot);
    expect(parsed).not.toBeNull();
    expect(parsed?.classIds).toEqual(["c1"]);
    expect(parsed?.before.map((s) => s.id)).toEqual(["s1"]);
    expect(parsed?.after.map((s) => s.id)).toEqual(["s1", "s2"]); // MON before WED
  });

  it("falls back to deriving classIds from the slot list and drops junk entries", () => {
    const parsed = parseRevisionSnapshot({
      before: [before[0], { id: 42 }],
      after,
    });
    expect(parsed?.classIds).toEqual(["c1"]);
    expect(parsed?.before).toHaveLength(1);
  });

  it("returns null for anything that is not a snapshot object", () => {
    expect(parseRevisionSnapshot(null)).toBeNull();
    expect(parseRevisionSnapshot("nope")).toBeNull();
    expect(parseRevisionSnapshot([1, 2, 3])).toBeNull();
    expect(revisionClassIds({ nonsense: true })).toEqual([]);
  });

  it("finds the newest revision that touched one of the classes", () => {
    const revisions = [
      { createdAt: new Date("2026-10-15T10:00:00Z"), snapshot: { classIds: ["c9"], before: [], after: [] } },
      { createdAt: new Date("2026-10-16T10:00:00Z"), snapshot: { classIds: ["c1"], before: [], after: [] } },
      { createdAt: new Date("2026-10-17T10:00:00Z"), snapshot: "garbage" },
    ];
    expect(latestRevisionTouching(revisions, ["c1"])?.toISOString()).toBe("2026-10-16T10:00:00.000Z");
    expect(latestRevisionTouching(revisions, ["c2"])).toBeNull();
    expect(latestRevisionTouching([], ["c1"])).toBeNull();
  });
});

describe("formatUpdatedBadge()", () => {
  it("renders 'Updated <date>' deterministically (UTC)", () => {
    expect(formatUpdatedBadge(new Date("2026-10-12T15:00:00Z"))).toBe("Updated 12 Oct 2026");
    expect(formatUpdatedBadge(new Date("2026-01-02T00:00:00Z"))).toBe("Updated 2 Jan 2026");
  });
});
