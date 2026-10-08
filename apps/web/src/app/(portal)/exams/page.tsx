import { AlertTriangle, CalendarClock, Flag } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getScheduleData, minToLabel } from "@/server/services/schedule";
import { ClashBadge } from "@/components/clash-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ClashKind } from "@/server/clash";

export const dynamic = "force-dynamic";

const EXAM_CLASH_KINDS: ClashKind[] = ["exam-vs-class", "exam-hall", "exam-cohort"];

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function ExamsPage() {
  const user = await requireUser();

  let data: Awaited<ReturnType<typeof getScheduleData>> | null = null;
  try {
    data = await getScheduleData(user);
  } catch (error) {
    console.error("exams load failed:", error);
    data = null;
  }

  const scope = user.role === "STUDENT" ? "your section" : "your scope";

  if (!data) {
    return (
      <>
        <PageHeader icon={CalendarClock} title="Exam Schedule" description={`Final examination dates for ${scope}.`} />
        <Alert variant="destructive">
          <AlertTitle>Exams unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const examRows = data.classes
    .flatMap((c) => c.exams.map((e) => ({ exam: e, cls: c })))
    .sort((a, b) => a.exam.date.getTime() - b.exam.date.getTime() || a.exam.startMin - b.exam.startMin);

  // Map exam id → clash kinds, using the exam-side id from each clash.
  const examIds = new Set(data.exams.map((e) => e.id));
  const examClashes = new Map<string, ClashKind[]>();
  for (const c of data.clashes) {
    if (!EXAM_CLASH_KINDS.includes(c.kind)) continue;
    const examId = examIds.has(c.a.id) ? c.a.id : c.b.id;
    const list = examClashes.get(examId) ?? [];
    list.push(c.kind);
    examClashes.set(examId, list);
  }

  const upcoming = examRows.filter(({ exam }) => exam.date.getTime() >= Date.now() - 12 * 60 * 60 * 1000);
  const next = upcoming[0];
  const flagged = examRows.filter(({ exam }) => (examClashes.get(exam.id) ?? []).length > 0).length;

  return (
    <>
      <PageHeader
        icon={CalendarClock}
        title="Exam Schedule"
        description={`Final examination dates for ${scope}, ordered by date. Clash flags resolve from the live timetable.`}
        actions={
          user.role === "STUDENT" ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/clashes">
                <Flag className="h-4 w-4" />
                Report a clash
              </Link>
            </Button>
          ) : undefined
        }
      />

      {examRows.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Exams scheduled"
            value={examRows.length}
            hint={upcoming.length !== examRows.length ? `${examRows.length - upcoming.length} completed` : "All upcoming"}
            icon={CalendarClock}
            tone="primary"
          />
          <StatCard
            label="Next exam"
            value={next ? `${daysUntil(next.exam.date) <= 0 ? "today" : `in ${daysUntil(next.exam.date)}d`}` : "—"}
            hint={
              next
                ? `${next.cls.courseCode} · ${next.exam.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })}`
                : "Nothing scheduled"
            }
            icon={AlertTriangle}
            tone={next && daysUntil(next.exam.date) <= 7 ? "warning" : "info"}
          />
          <StatCard
            label="Exams clashing"
            value={flagged}
            hint={flagged ? "Needs the exam cell to adjust" : "Date sheet is clean"}
            icon={AlertTriangle}
            tone={flagged ? "danger" : "success"}
          />
        </section>
      ) : null}

      {flagged > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{flagged} exam{flagged === 1 ? "" : "s"} clash with other events</AlertTitle>
          <AlertDescription>
            Seats or timing overlap with a class or another exam. The examination cell resolves these before
            the date sheet is finalised.
          </AlertDescription>
        </Alert>
      ) : null}

      {examRows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No exams scheduled yet"
          description="The date sheet is published a few weeks before the exam period. Check back after the coordinator releases it."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Hall</TableHead>
                  <TableHead className="pr-5">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examRows.map(({ exam, cls }) => {
                  const flags = examClashes.get(exam.id) ?? [];
                  const d = daysUntil(exam.date);
                  return (
                    <TableRow key={exam.id} className={flags.length ? "clash" : undefined}>
                      <TableCell className="pl-5">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {exam.date.toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              timeZone: "UTC",
                            })}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              d < 0
                                ? "w-fit border-border bg-muted text-muted-foreground"
                                : d <= 7
                                  ? "w-fit border-warning/30 bg-warning/10 text-warning"
                                  : "w-fit border-border bg-muted/60 text-muted-foreground"
                            }
                          >
                            {d < 0 ? "done" : d === 0 ? "today" : `in ${d} days`}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">{cls.courseCode}</span>
                        <span className="ml-2">{exam.courseTitle}</span>
                        <p className="text-xs text-muted-foreground">Section {cls.section}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {minToLabel(exam.startMin)}–{minToLabel(exam.endMin)}
                      </TableCell>
                      <TableCell>{exam.hall ?? "TBA"}</TableCell>
                      <TableCell className="space-x-1 pr-5">
                        {flags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          flags.map((k, i) => <ClashBadge key={i} kind={k} />)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
