import Link from "next/link";
import { AlertTriangle, CalendarClock, DoorOpen, FileText, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getExamManagerData } from "@/server/services/exam-manage";
import { getClashReport, minToLabel } from "@/server/services/schedule";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { StatTone } from "@/components/stat-card";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteExamAction, saveExamAction } from "./actions";

export const dynamic = "force-dynamic";

const FIELD =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Coordinator exam desk (spec §9): schedule, reschedule and cancel exams —
 * every save is clash-checked first, then students and faculty are notified. */
export default async function CoordinatorExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireCapability("timetable.manage");
  const { saved, error } = await searchParams;

  let data: Awaited<ReturnType<typeof getExamManagerData>> | null = null;
  let examClashes = 0;
  let dbError = false;
  try {
    data = await getExamManagerData();
    const report = await getClashReport();
    examClashes = report.active.filter((c) => c.kind.startsWith("exam")).length;
  } catch {
    dbError = true;
  }

  const exams = data?.exams ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = exams.filter((e) => e.date.toISOString().slice(0, 10) >= today).length;

  const tiles: { label: string; value: number | string; hint: string; icon: LucideIcon; tone: StatTone }[] = [
    { label: "Scheduled exams", value: exams.length, hint: "All semesters", icon: FileText, tone: "primary" },
    { label: "Upcoming", value: upcoming, hint: "From today onward", icon: CalendarClock, tone: "info" },
    { label: "Exam halls", value: data?.halls.length ?? 0, hint: "Halls and labs in use", icon: DoorOpen, tone: "info" },
    {
      label: "Exam clashes",
      value: examClashes,
      hint: examClashes === 0 ? "No exam conflicts detected" : "Resolve in the clash monitor",
      icon: AlertTriangle,
      tone: examClashes > 0 ? "danger" : "success",
    },
  ];

  return (
    <>
      <PageHeader
        icon={CalendarClock}
        title="Exam Manager"
        description="Schedule, move and cancel exams. Hall double-bookings, cohort overlaps and exam-inside-class collisions are blocked before they save; every change notifies the course and is audited."
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
          <AlertTitle>Exams unavailable</AlertTitle>
          <AlertDescription>The database didn&apos;t answer — try again in a moment.</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Exam numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatCard key={t.label} {...t} />
        ))}
      </section>

      <details className="rounded-xl border bg-card px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold">
          <Plus className="mr-1 inline h-3.5 w-3.5 text-primary" />
          Schedule an exam
        </summary>
        <form action={saveExamAction} className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1 lg:col-span-2">
            <Label htmlFor="ex-class" className="text-[11px] text-muted-foreground">
              Course section
            </Label>
            <select id="ex-class" name="classId" required defaultValue="" className={FIELD}>
              <option value="" disabled>
                — Pick a course —
              </option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} · {c.title} · Sec {c.section} ({c.semester})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ex-date" className="text-[11px] text-muted-foreground">
              Date
            </Label>
            <Input id="ex-date" type="date" name="date" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ex-start" className="text-[11px] text-muted-foreground">
                Start
              </Label>
              <input id="ex-start" type="time" name="start" defaultValue="09:00" className={FIELD} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ex-end" className="text-[11px] text-muted-foreground">
                End
              </Label>
              <input id="ex-end" type="time" name="end" defaultValue="11:00" className={FIELD} required />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ex-hall" className="text-[11px] text-muted-foreground">
              Hall
            </Label>
            <input id="ex-hall" name="hall" list="exam-halls" placeholder="Exam Hall A" className={FIELD} />
          </div>
          <SubmitButton pendingLabel="Scheduling…">Schedule exam</SubmitButton>
        </form>
        <datalist id="exam-halls">
          {(data?.halls ?? []).map((hall) => (
            <option key={hall} value={hall} />
          ))}
        </datalist>
      </details>

      {exams.length === 0 && !dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No exams scheduled</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use “Schedule an exam” above — students see their exam dates on{" "}
            <Link href="/exams" className="font-medium text-primary underline underline-offset-2">
              the exam schedule page
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Hall</TableHead>
                  <TableHead className="pr-5">Adjust / cancel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="pl-5 font-medium">{exam.courseTitle}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Sec {exam.class?.section ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{exam.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {minToLabel(exam.startMin)}–{minToLabel(exam.endMin)}
                    </TableCell>
                    <TableCell className="text-sm">{exam.hall ?? "—"}</TableCell>
                    <TableCell className="pr-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={saveExamAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={exam.id} />
                          <input type="hidden" name="classId" value={exam.classId ?? ""} />
                          <input
                            type="date"
                            name="date"
                            defaultValue={exam.date.toISOString().slice(0, 10)}
                            aria-label="Exam date"
                            className={FIELD}
                          />
                          <input
                            type="time"
                            name="start"
                            defaultValue={minToLabel(exam.startMin)}
                            aria-label="Start time"
                            className={FIELD}
                          />
                          <input
                            type="time"
                            name="end"
                            defaultValue={minToLabel(exam.endMin)}
                            aria-label="End time"
                            className={FIELD}
                          />
                          <input
                            type="text"
                            name="hall"
                            defaultValue={exam.hall ?? ""}
                            placeholder="Hall"
                            aria-label="Hall"
                            className={FIELD}
                          />
                          <SubmitButton size="sm" pendingLabel="Saving…">
                            Save
                          </SubmitButton>
                        </form>
                        <ConfirmAction
                          action={deleteExamAction}
                          values={{ id: exam.id }}
                          title="Cancel this exam?"
                          description={`${exam.courseTitle} on ${exam.date.toISOString().slice(0, 10)} — the course faculty and every enrolled student are notified.`}
                          confirmLabel="Cancel exam"
                          variant="destructive"
                          trigger={
                            <Button type="button" variant="outline" size="sm">
                              Remove
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Exam slot conflicts surface on{" "}
        <Link href="/coordinator/clashes" className="font-medium text-primary underline underline-offset-2">
          the clash monitor
        </Link>{" "}
        for the whole timetable. Students can report a missed clash from their own exams page.
      </p>
    </>
  );
}
