import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, CalendarDays, CircleCheck, MessageSquareWarning } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getScheduleData, minToLabel } from "@/server/services/schedule";
import { listMyClashReports } from "@/server/services/clash-reports";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ClashReportKind } from "@unisphere/db";
import { reportClashAction } from "./actions";

export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function ReportKindBadge({ kind }: { kind: ClashReportKind }) {
  const exam = kind === "EXAM";
  const Icon = exam ? CalendarClock : CalendarDays;
  return (
    <Badge
      variant="outline"
      className={
        exam
          ? "border-destructive/25 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/10 text-warning"
      }
    >
      <Icon />
      {exam ? "Exam" : "Timetable"}
    </Badge>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" });
}

export default async function ClashReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reported?: string; error?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard?denied=1");

  const { reported, error } = await searchParams;

  let data: Awaited<ReturnType<typeof getScheduleData>> | null = null;
  let reports: Awaited<ReturnType<typeof listMyClashReports>> | null = null;
  try {
    data = await getScheduleData(user);
    reports = await listMyClashReports(user);
  } catch (loadError) {
    console.error("clash reports load failed:", loadError);
    data = null;
    reports = null;
  }

  if (!data || !reports) {
    return (
      <>
        <PageHeader
          icon={AlertTriangle}
          title="Clash Reports"
          description="Report timetable or exam clashes to the coordination office and track their resolution."
        />
        <Alert variant="destructive">
          <AlertTitle>Clash reports unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const { classes, exams } = data;
  const openCount = reports.filter((r) => r.status === "OPEN").length;
  const resolvedCount = reports.filter((r) => r.status === "RESOLVED").length;
  const dismissedCount = reports.filter((r) => r.status === "DISMISSED").length;

  return (
    <>
      <PageHeader
        icon={AlertTriangle}
        title="Clash Reports"
        description="Report timetable or exam clashes to the coordination office and track their resolution."
      />

      {reported ? (
        <Alert variant="success">
          <AlertTitle>Clash reported</AlertTitle>
          <AlertDescription>
            Coordinators and administrators have been notified. The outcome of your report shows up below.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Clash not reported</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Clash report summary" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Open reports"
          value={openCount}
          hint={openCount > 0 ? "With the coordination office" : "Nothing pending"}
          icon={MessageSquareWarning}
          tone={openCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Resolved reports"
          value={resolvedCount}
          hint={dismissedCount > 0 ? `${dismissedCount} dismissed` : resolvedCount > 0 ? "Closed by coordinators" : "No resolutions yet"}
          icon={CircleCheck}
          tone={resolvedCount > 0 ? "success" : "default"}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Report a clash</h2>
        <Card className="max-w-2xl">
          <CardContent>
            <form action={reportClashAction} className="grid max-w-xl gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="kind">Clash type</Label>
                <select id="kind" name="kind" defaultValue="TIMETABLE" className={SELECT_CLASS}>
                  <option value="TIMETABLE">Timetable — classes or slots overlap</option>
                  <option value="EXAM">Exam — an exam overlaps another event</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="classId">Course or class</Label>
                <select id="classId" name="classId" defaultValue="" className={SELECT_CLASS}>
                  <option value="">Not sure / not listed</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode} — {c.title} (Section {c.section})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="otherClassId">Clashes with another course (optional)</Label>
                <select id="otherClassId" name="otherClassId" defaultValue="" className={SELECT_CLASS}>
                  <option value="">No second course</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode} — {c.title} (Section {c.section})
                    </option>
                  ))}
                </select>
              </div>
              {exams.length > 0 ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="examId">Involved exam (optional)</Label>
                  <select id="examId" name="examId" defaultValue="" className={SELECT_CLASS}>
                    <option value="">No exam involved</option>
                    {exams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {`${new Date(e.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          timeZone: "UTC",
                        })} · ${minToLabel(e.startMin)}–${minToLabel(e.endMin)} · ${e.courseTitle}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="What overlaps with what — course, day and time. e.g. CS-305 and CS-310 both have lab slots Thursday 10:00."
                />
              </div>
              <SubmitButton pendingLabel="Submitting…" className="w-fit">
                Report clash
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">My clash reports</h2>
        {reports.length === 0 ? (
          <EmptyState
            icon={MessageSquareWarning}
            title="No clash reports yet"
            description="Spotted an overlap in your timetable or exam schedule? Report it with the form above — coordinators are notified instantly and updates appear here."
            compact
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead className="pr-5">Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5">
                        <ReportKindBadge kind={r.kind} />
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal">{r.description}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                        {r.resolutionNote ?? "—"}
                      </TableCell>
                      <TableCell className="pr-5 text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
