import Link from "next/link";
import { AlertTriangle, CalendarCog, CalendarDays, DoorOpen, History, Plus, Undo2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import {
  getTimetableManagerData,
  listTimetableRevisions,
  WINDOW_END,
  WINDOW_START,
} from "@/server/services/timetable-manage";
import { minToLabel } from "@/server/services/schedule";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { StatTone } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { SlotImpactForm } from "@/components/timetable-impact-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteSlotAction,
  previewSlotChangeAction,
  revertToRevisionAction,
  saveClassAction,
  saveSlotAction,
} from "./actions";

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

/** "2026-10-17 09:41 UTC" — revision timestamps are absolute (UTC). */
function formatStamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Coordinators own the weekly grid: add, move and cancel sessions here. */
export default async function CoordinatorTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireCapability("timetable.manage");
  const { saved, error } = await searchParams;

  let data: Awaited<ReturnType<typeof getTimetableManagerData>> | null = null;
  let dbError = false;
  try {
    data = await getTimetableManagerData();
  } catch {
    dbError = true;
  }

  let revisions: Awaited<ReturnType<typeof listTimetableRevisions>> = [];
  try {
    revisions = await listTimetableRevisions(user, 10);
  } catch {
    revisions = [];
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
        description="Reschedule, add and cancel sessions. Every save is impact-previewed first, keeps a version history with one-click revert, and notifies the class and its enrolled students exactly once."
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

      <details className="rounded-xl border bg-card px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold">
          <Plus className="mr-1 inline h-3.5 w-3.5 text-primary" />
          Create a course section{" "}
          <span className="font-normal text-muted-foreground">— then add its weekly sessions below</span>
        </summary>
        <form action={saveClassAction} className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-code" className="text-[11px] text-muted-foreground">
              Course code
            </Label>
            <Input id="nc-code" name="courseCode" placeholder="CS-401" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-title" className="text-[11px] text-muted-foreground">
              Title
            </Label>
            <Input id="nc-title" name="title" placeholder="Machine Learning" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-section" className="text-[11px] text-muted-foreground">
              Section
            </Label>
            <Input id="nc-section" name="section" placeholder="A" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-credits" className="text-[11px] text-muted-foreground">
              Credits
            </Label>
            <Input id="nc-credits" name="credits" inputMode="numeric" placeholder="3" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-dept" className="text-[11px] text-muted-foreground">
              Department
            </Label>
            <Input id="nc-dept" name="department" defaultValue="Computer Science" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-semester" className="text-[11px] text-muted-foreground">
              Semester
            </Label>
            <Input id="nc-semester" name="semester" defaultValue="Fall 2026" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nc-faculty" className="text-[11px] text-muted-foreground">
              Faculty
            </Label>
            <select id="nc-faculty" name="facultyId" defaultValue="" className={FIELD}>
              <option value="">— Assign later —</option>
              {(data?.faculty ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.employeeId ? ` (${f.employeeId})` : ""}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton pendingLabel="Creating…">Create section</SubmitButton>
        </form>
      </details>

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
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <form action={saveClassAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={cls.id} />
                  <input type="hidden" name="courseCode" value={cls.courseCode} />
                  <input type="hidden" name="title" value={cls.title} />
                  <input type="hidden" name="section" value={cls.section} />
                  <input type="hidden" name="department" value={cls.department} />
                  <input type="hidden" name="semester" value={cls.semester} />
                  <input type="hidden" name="credits" value={cls.credits ?? ""} />
                  <select
                    name="facultyId"
                    defaultValue={cls.facultyId ?? ""}
                    aria-label={`Faculty for ${cls.courseCode}`}
                    className={FIELD}
                  >
                    <option value="">— No faculty —</option>
                    {(data?.faculty ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.employeeId ? ` (${f.employeeId})` : ""}
                      </option>
                    ))}
                  </select>
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
                    Assign
                  </SubmitButton>
                </form>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {cls._count.enrollments} enrolled
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col divide-y p-0">
              {cls.slots.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No sessions scheduled yet.</p>
              ) : (
                cls.slots.map((slot) => (
                  <div key={slot.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <SlotImpactForm
                      classId={cls.id}
                      slotId={slot.id}
                      defaults={{
                        day: slot.day,
                        start: minToLabel(slot.startMin),
                        end: minToLabel(slot.endMin),
                        room: slot.room ?? "",
                      }}
                      rooms={data?.rooms ?? []}
                      previewAction={previewSlotChangeAction}
                      saveAction={saveSlotAction}
                      submitLabel="Preview…"
                    />
                    <ConfirmAction
                      action={deleteSlotAction}
                      values={{ id: slot.id }}
                      title="Cancel this session?"
                      description={`${cls.courseCode} · ${DAY_LABELS[slot.day] ?? slot.day} ${minToLabel(slot.startMin)}–${minToLabel(slot.endMin)} — the class faculty and every enrolled student are notified.`}
                      confirmLabel="Cancel session"
                      variant="destructive"
                      reason={{ name: "note", label: "Note (optional)", placeholder: "Why is this session cancelled?" }}
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
                <div className="mt-3">
                  <SlotImpactForm
                    classId={cls.id}
                    defaults={{ day: "MON", start: "09:00", end: "10:30", room: "" }}
                    rooms={data?.rooms ?? []}
                    previewAction={previewSlotChangeAction}
                    saveAction={saveSlotAction}
                    submitLabel="Preview & add"
                  />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <section aria-label="Timetable history" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 font-heading text-base font-semibold">
            <History className="h-4 w-4 text-primary" /> History
          </h2>
          <p className="text-xs text-muted-foreground">
            Every publish lands here — revert undoes a change and notifies the affected courses.
          </p>
        </div>
        {revisions.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              No revisions yet — the next session you save appears here with a one-click revert.
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y">
              {revisions.map((revision) => (
                <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{revision.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {revision.actor.name} · {formatStamp(revision.createdAt)}
                      {revision.note ? ` · ${revision.note}` : ""}
                    </p>
                  </div>
                  <ConfirmAction
                    action={revertToRevisionAction}
                    values={{ revisionId: revision.id }}
                    title={`Revert “${revision.label}”?`}
                    description="This undoes the change: the timetable goes back to the state recorded just before it, a new “Revert to …” revision is recorded, and every affected course is notified."
                    confirmLabel="Revert"
                    reason={{ name: "note", label: "Note (optional)", placeholder: "Why are you reverting?" }}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        <Undo2 className="h-3.5 w-3.5" />
                        Revert
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

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
