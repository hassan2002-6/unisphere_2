import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { minToLabel, formatDay } from "@/server/services/schedule";
import type { ClassWithSchedule } from "@/server/services/schedule";
import type { Clash } from "@/server/clash";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

type Block = {
  slotId: string;
  classId: string;
  courseCode: string;
  title: string;
  section: string;
  room: string | null;
  startMin: number;
  endMin: number;
  faculty: string | null;
  clash: boolean;
};

export function TimetableGrid({
  classes,
  clashes,
}: {
  classes: ClassWithSchedule[];
  clashes: Clash[];
}) {
  const clashSlotIds = new Set<string>();
  for (const c of clashes) {
    if (c.kind === "exam-vs-class") clashSlotIds.add(c.b.id);
    else {
      clashSlotIds.add(c.a.id);
      clashSlotIds.add(c.b.id);
    }
  }

  const byDay = new Map<string, Block[]>();
  for (const cls of classes) {
    for (const slot of cls.slots) {
      const list = byDay.get(slot.day) ?? [];
      list.push({
        slotId: slot.id,
        classId: cls.id,
        courseCode: cls.courseCode,
        title: cls.title,
        section: cls.section,
        room: slot.room,
        startMin: slot.startMin,
        endMin: slot.endMin,
        faculty: cls.faculty?.name ?? null,
        clash: clashSlotIds.has(slot.id),
      });
      byDay.set(slot.day, list);
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startMin - b.startMin || a.courseCode.localeCompare(b.courseCode));

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {DAYS.map((day) => {
        const blocks = byDay.get(day) ?? [];
        return (
          <Card key={day} className="flex flex-col">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{formatDay(day)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2 pb-3">
              {blocks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No classes</p>
              ) : (
                blocks.map((b) => (
                  <div
                    key={b.slotId}
                    className={`rounded-md border border-l-4 bg-card px-2.5 py-2 text-xs shadow-sm ${
                      b.clash ? "border-destructive/40 border-l-destructive bg-destructive/5" : "border-l-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold">{b.courseCode}</span>
                      {b.clash ? (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 px-1 py-0 text-[10px] text-destructive">
                          clash
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-muted-foreground">{b.title}</p>
                    <p className="mt-1 font-mono text-[11px]">
                      {minToLabel(b.startMin)}–{minToLabel(b.endMin)}
                    </p>
                    <p className="text-muted-foreground">
                      {b.room ?? "TBA"}
                      {b.faculty ? ` · ${b.faculty}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
