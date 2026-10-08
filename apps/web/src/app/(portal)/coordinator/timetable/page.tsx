import Link from "next/link";
import { AlertTriangle, CalendarCog, CalendarDays, DoorOpen, Plus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getTimetableManagerData, MANAGER_DAYS, WINDOW_END, WINDOW_START } from "@/server/services/timetable-manage";
import { minToLabel } from "@/server/services/schedule";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { StatTone } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSlotAction, saveSlotAction } from "./actions";

export const dynamic = "force-dynamic";

const DAY_LABELS: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

const FIELD =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Coordinators own the weekly grid: add, move and cancel sessions here. */
export default async function CoordinatorTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireCapability("timetable.manage");
  const { saved, error } = await searchParams;

  let data: Awaited<ReturnType<typeof getTimetableManagerData>> | null = null;
  let dbError = false;
  try {
    data = await getTimetableManagerData();
  } catch {
    dbError = true;
  }

  const classes = data?.classes ?? [];
  const clashCount = data?.clashes.length ?? 0;
  const sessionCount = classes.reduce((sum, c) => sum + c.slots.length, 0);

  const tiles: { label: string; value: number | string; hint: string; icon: LucideIcon; tone: StatTone }[] = [
    { label: "Classes", value: classes.length, hint: "Across all semesters", icon: CalendarDays, tone: "primary" },
    { label: "Weekly sessions", value: sessionCount, hint: `${WINDOW_START / 60}:00 – ${WINDOW_END / 60}:00 teaching window`, icon: CalendarCog, tone: "info" },
    { label: "Rooms in use", value: data?.rooms.length ?? 0, hint: "Distinct rooms booked", icon: DoorOpen, tone: "info" },
    { label: "Active clashes", value: clashCount, hint: clashCount === 0 ? "Grid is clash-free" : "See the clash monitor", icon: AlertTriangle, tone: clashCount > 0 ? "danger" : "success" },
  ];

  return (
    <>
      <PageHeader
        icon={CalendarCog}
        title="Timetable Manager"
        description="Reschedule, add and cancel sessions. Room, faculty and cohort double-bookings are blocked before they save; every change notifies the class and lands in the audit log."
      />

      {saved ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{saved}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Timetable unavailable</AlertTitle>
          <AlertDescription>The database didn&apos;t answer — try again in a moment.</AlertDescription>
        </Alert>
      ) : null}
      {clashCount > 0 ? (
        <Alert variant="warning">
          <AlertTitle>
            {clashCount} scheduling conflict{clashCount === 1 ? "" : "s"} on the grid
          </AlertTitle>
          <AlertDescription>
            <Link href="/coordinator/clashes" className="font-medium underline underline-offset-2">
              Open the clash monitor
            </Link>{" "}
            to resolve or acknowledge them.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Timetable numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatCard key={t.label} {...t} />
        ))}
      </section>

      <datalist id="tt-rooms">
        {(data?.rooms ?? []).map((room) => (
          <option key={room} value={room} />
        ))}
      </datalist>

      <div className="flex flex-col gap-4">
        {classes.map((cls) => (
          <Card key={cls.id} className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  {cls.courseCode} · {cls.title}
                </CardTitle>
                <Badge variant="secondary">Section {cls.section}</Badge>
                <Badge variant="outline">{cls.semester}</Badge>
                <span className="text-xs text-muted-foreground">
                  {cls.faculty ? `${cls.faculty.name}${cls.faculty.employeeId ? ` (${cls.faculty.employeeId})` : ""}` : "No faculty assigned"}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {cls._count.enrollments} enrolled
              </span>
            </CardHeader>
            <CardContent className="flex flex-col divide-y p-0">
              {cls.slots.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No sessions scheduled yet.</p>
              ) : (
                cls.slots.map((slot) => (
                  <div key={slot.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <form action={saveSlotAction} className="grid items-center gap-2 sm:grid-cols-[7.5rem_6.5rem_6.5rem_minmax(0,1fr)_auto]">
                      <input type="hidden" name="classId" value={cls.id} />
                      <input type="hidden" name="id" value={slot.id} />
                      <select name="day" defaultValue={slot.day} className={FIELD} aria-label="Day">
                        {MANAGER_DAYS.map((d) => (
                          <option key={d} value={d}>
                            {DAY_LABELS[d]}
                          </option>
                        ))}
                      </select>
                      <input type="time" name="start" defaultValue={minToLabel(slot.startMin)} className={FIELD} aria-label="Start time" />
                      <input type="time" name="end" defaultValue={minToLabel(slot.endMin)} className={FIELD} aria-label="End time" />
                      <input
                        type="text"
                        name="room"
                        defaultValue={slot.room ?? ""}
                        list="tt-rooms"
                        placeholder="Room"
                        className={FIELD}
                        aria-label="Room"
                      />
                      <SubmitButton size="sm" pendingLabel="Saving…">
                        Save
                      </SubmitButton>
                    </form>
                    <ConfirmAction
                      action={deleteSlotAction}
                      values={{ id: slot.id }}
                      title="Cancel this session?"
                      description={`${cls.courseCode} · ${DAY_LABELS[slot.day] ?? slot.day} ${minToLabel(slot.startMin)}–${minToLabel(slot.endMin)} — the class faculty and every enrolled student are notified.`}
                      confirmLabel="Cancel session"
                      variant="destructive"
                      trigger={
                        <Button type="button" variant="outline" size="sm">
                          Remove
                        </Button>
                      }
                    />
                  </div>
                ))
              )}

              <details className="px-4 py-3">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Add a session to {cls.courseCode}
                </summary>
                <form action={saveSlotAction} className="mt-3 grid items-end gap-3 sm:grid-cols-[7.5rem_6.5rem_6.5rem_minmax(0,1fr)_auto]">
                  <input type="hidden" name="classId" value={cls.id} />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`day-${cls.id}`} className="text-[11px] text-muted-foreground">
                      Day
                    </Label>
                    <select id={`day-${cls.id}`} name="day" defaultValue="MON" className={FIELD}>
                      {MANAGER_DAYS.map((d) => (
                        <option key={d} value={d}>
                          {DAY_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`start-${cls.id}`} className="text-[11px] text-muted-foreground">
                      Start
                    </Label>
                    <input id={`start-${cls.id}`} type="time" name="start" defaultValue="09:00" className={FIELD} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`end-${cls.id}`} className="text-[11px] text-muted-foreground">
                      End
                    </Label>
                    <input id={`end-${cls.id}`} type="time" name="end" defaultValue="10:30" className={FIELD} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`room-${cls.id}`} className="text-[11px] text-muted-foreground">
                      Room
                    </Label>
                    <Input id={`room-${cls.id}`} name="room" list="tt-rooms" placeholder="e.g. C-204" />
                  </div>
                  <SubmitButton size="sm" pendingLabel="Adding…">
                    Add session
                  </SubmitButton>
                </form>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Rooms are free text — use the suggestions from the current grid to keep them consistent. Status of a slot shows on{" "}
        <Link href="/timetable" className="font-medium text-primary underline underline-offset-2">
          the timetable page
        </Link>{" "}
        as soon as it revalidates.
      </p>

      {sessionCount === 0 && !dbError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <StatusBadge status="PENDING" />
          <p className="text-sm text-muted-foreground">No classes are configured yet — seed the database to get the Fall 2026 grid.</p>
        </div>
      ) : null}
    </>
  );
}
