import Link from "next/link";
import { BadgeCheck, ClipboardList, Clock, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ServiceError, listMyAssignments } from "@/server/services/assignments";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Rough "due in N days" hint derived from the raw deadline. */
function dueHint(deadline: Date, now: Date): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms < 0) {
    const overdue = Math.floor(-ms / DAY_MS);
    return overdue === 0 ? "past due" : `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
  }
  if (ms < DAY_MS) return "due today";
  const days = Math.ceil(ms / DAY_MS);
  return days === 1 ? "due tomorrow" : `due in ${days} days`;
}

export default async function AssignmentsPage() {
  const user = await requireUser();

  let rows: Awaited<ReturnType<typeof listMyAssignments>> | null = null;
  let loadError = "The database did not answer — check DATABASE_URL and the Neon project.";
  try {
    rows = await listMyAssignments(user);
  } catch (e) {
    loadError = e instanceof ServiceError ? e.message : loadError;
  }

  if (!rows) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Assignments" />
        <Alert variant="destructive">
          <AlertTitle>Assignments unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </>
    );
  }

  const now = new Date();
  const items = rows.map((a) => {
    const submission = a.submissions[0] ?? null;
    const past = a.deadline.getTime() < now.getTime();
    return { a, submission, past, graded: Boolean(submission?.gradedAt) };
  });

  // Upcoming first (nearest deadline), then the past (most recently due first).
  const ordered = [
    ...items.filter((i) => !i.past).sort((x, y) => x.a.deadline.getTime() - y.a.deadline.getTime()),
    ...items.filter((i) => i.past).sort((x, y) => y.a.deadline.getTime() - x.a.deadline.getTime()),
  ];

  const dueSoon = items.filter(
    (i) => !i.submission && !i.a.closedAt && !i.past && i.a.deadline.getTime() - now.getTime() <= 7 * DAY_MS,
  ).length;
  const submitted = items.filter((i) => i.submission).length;
  const graded = items.filter((i) => i.graded).length;

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="Assignments"
        description="Every assignment across your enrolled classes — deadlines, submissions and results."
      />

      {rows.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Due soon"
            value={dueSoon}
            hint="Unsubmitted, due within 7 days"
            icon={Clock}
            tone={dueSoon > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Submitted"
            value={submitted}
            hint={`Out of ${rows.length} assignment${rows.length === 1 ? "" : "s"}`}
            icon={Upload}
            tone="info"
          />
          <StatCard
            label="Graded"
            value={graded}
            hint="Marks released with feedback"
            icon={BadgeCheck}
            tone={graded > 0 ? "success" : "default"}
          />
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Assignments posted to the classes you are enrolled in will appear here with their deadlines."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Assignment</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Max marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="pr-5 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map(({ a, submission, past, graded: isGraded }) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5">
                        <Link
                          href={`/assignments/${a.id}`}
                          className="font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                          {a.class.courseCode}
                        </Link>
                        <Link href={`/assignments/${a.id}`} className="ml-2 font-medium hover:underline">
                          {a.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {a.class.title} · Section {a.class.section}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{fmtDateTime(a.deadline)}</span>
                        <p className="text-xs text-muted-foreground">{a.closedAt ? "closed" : dueHint(a.deadline, now)}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">{a.maxMarks}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          {isGraded ? (
                            <Badge variant="outline" className="border-success/25 bg-success/10 text-success">
                              Graded
                            </Badge>
                          ) : submission ? (
                            <StatusBadge status="SUBMITTED" />
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Not started
                            </Badge>
                          )}
                          {submission?.isLate ? <StatusBadge status="LATE" /> : null}
                          {!submission && past && !a.closedAt ? <StatusBadge status="OVERDUE" /> : null}
                          {a.closedAt ? <StatusBadge status="CLOSED" /> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isGraded ? (
                          <span className="font-mono text-xs tabular-nums">
                            {submission?.marks ?? "—"}/{a.maxMarks}
                          </span>
                        ) : submission ? (
                          <span className="text-xs text-muted-foreground">Awaiting grading</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/assignments/${a.id}`}>{submission ? "View" : "Open"}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
