import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { minToLabel, formatDay } from "@/server/services/schedule";
import type { ClassWithSchedule } from "@/server/services/schedule";
import type { Clash } from "@/server/clash";
import { cn } from "cn";

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

function todayKey(): string | null {
  const idx = new Date().getDay(); // 0 = Sunday
  return idx === 0 ? null : DAYS[idx - 1];
}

/** Weekly schedule: one column per day with clash flags and a "today" highlight. */
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
  for (const list of byDay.values())
    list.sort((a, b) => a.startMin - b.startMin || a.courseCode.localeCompare(b.courseCode));

  const today = todayKey();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Class
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Clash
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-primary/50" /> Today
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {DAYS.map((day) => {
          const blocks = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <Card
              key={day}
              className={cn("flex flex-col gap-0 overflow-hidden py-0", isToday && "ring-2 ring-primary/40")}
            >
              <CardHeader className="flex-row items-center justify-between border-b px-3.5 py-2.5">
                <CardTitle className="text-sm font-semibold">{formatDay(day)}</CardTitle>
                {isToday ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Today
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{blocks.length || "—"}</span>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 p-3">
                {blocks.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center py-4 text-xs text-muted-foreground">
                    Free day
                  </p>
                ) : (
                  blocks.map((b) => (
                    <div
                      key={b.slotId}
                      className={cn(
                        "rounded-md border border-l-4 bg-card px-2.5 py-2 text-xs shadow-sm transition-shadow hover:shadow",
                        b.clash ? "clash border-[#f3bcc5]" : "border-l-primary",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold">{b.courseCode}</span>
                        {b.clash ? <span className="clash-tag">CLASH</span> : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-muted-foreground">{b.title}</p>
                      <p className="mt-1 font-mono text-[11px] tabular-nums">
                        {minToLabel(b.startMin)}–{minToLabel(b.endMin)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
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
    </div>
  );
}
