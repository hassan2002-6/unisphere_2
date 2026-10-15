import Link from "next/link";
import { Clock, ClipboardList, Inbox, PencilLine, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ServiceError, UPLOAD_TYPES, listFacultyAssignments } from "@/server/services/assignments";
import { getClassesFor } from "@/server/services/schedule";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createAssignmentAction } from "./actions";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES)
  .map((t) => `.${t}`)
  .join(",");

const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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

export default async function FacultyAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { ok, error } = await searchParams;

  if (!can(user.role, "assignments.manage")) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Assignments (Faculty)" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Assignment management is limited to faculty and administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  let rows: Awaited<ReturnType<typeof listFacultyAssignments>> | null = null;
  let loadError = "The database did not answer — check the Neon project and DATABASE_URL.";
  try {
    rows = await listFacultyAssignments(user);
  } catch (e) {
    loadError = e instanceof ServiceError ? e.message : loadError;
  }

  let classes: Awaited<ReturnType<typeof getClassesFor>> = [];
  try {
    classes = await getClassesFor(user);
  } catch {
    classes = [];
  }

  if (!rows) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Assignments (Faculty)" />
        <Alert variant="destructive">
          <AlertTitle>Assignments unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </>
    );
  }

  const now = new Date();
  // Still-submittable assignments first (nearest deadline), then the closed ones.
  const ordered = [
    ...rows.filter((r) => !r.closedAt).sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
    ...rows.filter((r) => r.closedAt).sort((a, b) => b.deadline.getTime() - a.deadline.getTime()),
  ];
  const openCount = rows.filter((r) => !r.closedAt).length;
  const submissionCount = rows.reduce((n, r) => n + r._count.submissions, 0);
  const awaitingGrading = rows.reduce((n, r) => n + r.submissions.filter((s) => !s.gradedAt).length, 0);

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="Assignments (Faculty)"
        description="Assignments across the classes you teach — deadlines, submission counts and grading."
        actions={
          <Button asChild>
            <Link href="#new-assignment">
              <Plus className="h-4 w-4" />
              New assignment
            </Link>
          </Button>
        }
      />

      {ok ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>The assignment has been updated.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action not applied</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Open"
            value={openCount}
            hint="Not closed — students can still submit"
            icon={Clock}
            tone={openCount > 0 ? "primary" : "default"}
          />
          <StatCard
            label="Submissions"
            value={submissionCount}
            hint="Received across your assignments"
            icon={Inbox}
            tone="info"
          />
          <StatCard
            label="Awaiting grading"
            value={awaitingGrading}
            hint="Submitted, not yet graded"
            icon={PencilLine}
            tone={awaitingGrading > 0 ? "warning" : "success"}
          />
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Create your first assignment below — every enrolled student is notified the moment it is posted."
          action={
            <Button variant="outline" asChild>
              <Link href="#new-assignment">New assignment</Link>
            </Button>
          }
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
                    <TableHead>Submissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Graded</TableHead>
                    <TableHead className="pr-5 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map((a) => {
                    const gradedCount = a.submissions.filter((s) => Boolean(s.gradedAt)).length;
                    const lateCount = a.submissions.filter((s) => s.isLate).length;
                    const past = a.deadline.getTime() < now.getTime();
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="pl-5">
                          <Link
                            href={`/faculty/assignments/${a.id}`}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {a.class.courseCode}
                          </Link>
                          <Link href={`/faculty/assignments/${a.id}`} className="ml-2 font-medium hover:underline">
                            {a.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {a.class.title} · Section {a.class.section}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{fmtDateTime(a.deadline)}</span>
                          <p className="text-xs text-muted-foreground">
                            {a.closedAt ? "closed" : dueHint(a.deadline, now)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs tabular-nums">{a._count.submissions}</span>
                          <p className="text-xs text-muted-foreground">
                            {lateCount > 0 ? `${lateCount} late` : "on time so far"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {a.closedAt ? (
                            <StatusBadge status="CLOSED" />
                          ) : past ? (
                            <StatusBadge status="OVERDUE" />
                          ) : (
                            <StatusBadge status="OPEN" />
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs tabular-nums">
                            {gradedCount}/{a._count.submissions}
                          </span>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/faculty/assignments/${a.id}`}>Manage</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card id="new-assignment" className="max-w-2xl scroll-mt-24">
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4 text-muted-foreground" />
            New assignment
          </CardTitle>
          <CardDescription>Posted to the class immediately — every enrolled student is notified.</CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No classes to post to yet. Classes appear here once the coordinator assigns them to you.
            </p>
          ) : (
            <form action={createAssignmentAction} className="grid max-w-xl gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="classId">
                  Class <span className="text-destructive">*</span>
                </Label>
                <select
                  id="classId"
                  name="classId"
                  required
                  defaultValue={classes[0]?.id ?? ""}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode} — {c.title} ({c.section})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  required
                  minLength={4}
                  maxLength={150}
                  placeholder="e.g. Lab Report 1"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="instructions">
                  Instructions <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="instructions"
                  name="instructions"
                  required
                  minLength={10}
                  maxLength={6000}
                  rows={6}
                  placeholder="What to submit, how to structure it, marking notes…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="deadline">
                    Deadline <span className="text-destructive">*</span>
                  </Label>
                  <Input id="deadline" name="deadline" type="datetime-local" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="maxMarks">
                    Max marks <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="maxMarks"
                    name="maxMarks"
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    defaultValue={100}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="allowedTypes">Allowed file types</Label>
                <Input
                  id="allowedTypes"
                  name="allowedTypes"
                  placeholder="pdf, docx, zip — leave blank to accept every supported type"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="attachment">Attachment (optional, max 2 MB)</Label>
                <Input id="attachment" name="attachment" type="file" accept={UPLOAD_ACCEPT} className="h-9 py-1.5" />
              </div>
              <SubmitButton pendingLabel="Posting…" className="w-fit">
                Post assignment
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}
