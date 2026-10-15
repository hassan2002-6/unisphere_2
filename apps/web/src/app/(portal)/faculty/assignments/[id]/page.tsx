import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  Download,
  FileText,
  Inbox,
  PencilLine,
  TriangleAlert,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ServiceError, getFacultyAssignment, normaliseAllowedTypes } from "@/server/services/assignments";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { closeAssignmentAction, gradeSubmissionAction, updateAssignmentAction } from "../actions";

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

/** Prisma Date → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function FacultyAssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { ok, error } = await searchParams;

  if (!can(user.role, "assignments.manage")) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Assignment" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Assignment management is limited to faculty and administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  let data: Awaited<ReturnType<typeof getFacultyAssignment>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getFacultyAssignment(user, id);
  } catch (e) {
    loadError = e instanceof ServiceError ? e.message : "Something went wrong loading this assignment.";
  }

  if (!data) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Assignment" />
        <Alert variant="destructive">
          <AlertTitle>Assignment unavailable</AlertTitle>
          <AlertDescription>{loadError ?? "Assignment not found."}</AlertDescription>
        </Alert>
      </>
    );
  }

  const { assignment, roster } = data;
  const now = new Date();
  const past = assignment.deadline.getTime() < now.getTime();
  const allowed = normaliseAllowedTypes(assignment.allowedTypes);
  const submittedIds = new Set(assignment.submissions.map((s) => s.studentId));
  const notSubmitted = roster.filter((s) => !submittedIds.has(s.id));
  const gradedCount = assignment.submissions.filter((s) => Boolean(s.gradedAt)).length;
  const awaitingGrading = assignment.submissions.filter((s) => !s.gradedAt).length;
  const lateCount = assignment.submissions.filter((s) => s.isLate).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Assignments", href: "/faculty/assignments" }, { label: assignment.title }]}
        icon={ClipboardList}
        title={`${assignment.class.courseCode} — ${assignment.title}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {assignment.class.courseCode}
            </Badge>
            <span>
              {assignment.class.title} · Section {assignment.class.section}
            </span>
            <span aria-hidden>·</span>
            <span>due {fmtDateTime(assignment.deadline)}</span>
            <Badge variant="secondary">{assignment.maxMarks} marks</Badge>
            {assignment.closedAt ? (
              <StatusBadge status="CLOSED" />
            ) : past ? (
              <StatusBadge status="OVERDUE" />
            ) : (
              <StatusBadge status="OPEN" />
            )}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/faculty/assignments">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {assignment.attachmentName ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/api/assignments/${assignment.id}/attachment`}>
                  <Download className="h-3.5 w-3.5" />
                  {assignment.attachmentName}
                </Link>
              </Button>
            ) : null}
            {assignment.closedAt ? (
              <ConfirmAction
                action={closeAssignmentAction}
                values={{ id: assignment.id, closed: "0" }}
                title="Reopen this assignment?"
                description="Students can submit or resubmit again; late submissions stay flagged."
                confirmLabel="Reopen"
                trigger={
                  <Button variant="outline" size="sm">
                    <Undo2 className="h-4 w-4" />
                    Reopen
                  </Button>
                }
              />
            ) : (
              <ConfirmAction
                action={closeAssignmentAction}
                values={{ id: assignment.id, closed: "1" }}
                title="Close this assignment?"
                description="Students can no longer submit or resubmit. Existing submissions and grades are kept."
                confirmLabel="Close assignment"
                variant="destructive"
                trigger={
                  <Button variant="destructive" size="sm">
                    <X className="h-4 w-4" />
                    Close
                  </Button>
                }
              />
            )}
          </>
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Submitted"
          value={`${assignment.submissions.length}/${roster.length}`}
          hint="Of the enrolled students"
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="Awaiting grading"
          value={awaitingGrading}
          hint="Submitted, not yet graded"
          icon={PencilLine}
          tone={awaitingGrading > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Graded"
          value={gradedCount}
          hint="Marks and feedback released"
          icon={BadgeCheck}
          tone={gradedCount > 0 ? "success" : "default"}
        />
        <StatCard
          label="Late"
          value={lateCount}
          hint="Flagged after the deadline"
          icon={TriangleAlert}
          tone={lateCount > 0 ? "danger" : "default"}
        />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Instructions
            </CardTitle>
            <CardDescription>
              Deadline {fmtDateTime(assignment.deadline)} ({dueHint(assignment.deadline, now)}) ·{" "}
              {assignment.closedAt ? `closed ${fmtDateTime(assignment.closedAt)}` : "open for submissions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{assignment.instructions}</p>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Accepted file types: {allowed.join(", ")}</span>
              <span aria-hidden>·</span>
              <span>{assignment.maxMarks} marks · created {fmtDateTime(assignment.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PencilLine className="h-4 w-4 text-muted-foreground" />
              Edit assignment
            </CardTitle>
            <CardDescription>
              Changes apply immediately; students are notified when the deadline moves or the assignment is closed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAssignmentAction} className="grid gap-4">
              <input type="hidden" name="id" value={assignment.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input id="title" name="title" required minLength={4} maxLength={150} defaultValue={assignment.title} />
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
                  defaultValue={assignment.instructions}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="deadline">
                    Deadline <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="deadline"
                    name="deadline"
                    type="datetime-local"
                    required
                    defaultValue={toLocalInput(assignment.deadline)}
                  />
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
                    required
                    defaultValue={assignment.maxMarks}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="allowedTypes">Allowed file types</Label>
                <Input
                  id="allowedTypes"
                  name="allowedTypes"
                  defaultValue={assignment.allowedTypes ?? ""}
                  placeholder="pdf, docx, zip — blank accepts every supported type"
                />
              </div>
              <SubmitButton pendingLabel="Saving…" className="w-fit">
                Save changes
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            Submissions
          </CardTitle>
          <CardDescription>
            {assignment.submissions.length} of {roster.length} students submitted
            {gradedCount > 0 ? ` · ${gradedCount} graded` : ""}
            {lateCount > 0 ? ` · ${lateCount} late` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignment.submissions.length === 0 ? (
            <EmptyState
              compact
              icon={Inbox}
              title="No submissions yet"
              description="They appear here the moment a student uploads a file."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Student</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="pr-5">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignment.submissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-5">
                        <p className="font-medium">{s.student.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{s.student.registrationNo}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{fmtDateTime(s.submittedAt)}</span>
                        <p className="text-xs text-muted-foreground">Attempt {s.attempt}</p>
                      </TableCell>
                      <TableCell>
                        {s.isLate ? (
                          <StatusBadge status="LATE" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/api/assignments/submissions/${s.id}/file`}
                          className="inline-flex items-center gap-1.5 text-sm hover:underline"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="max-w-[180px] truncate">{s.fileName}</span>
                        </Link>
                        {s.note ? <p className="text-xs text-muted-foreground">“{s.note}”</p> : null}
                      </TableCell>
                      <TableCell className="pr-5">
                        <form action={gradeSubmissionAction} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="submissionId" value={s.id} />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <input type="hidden" name="maxMarks" value={assignment.maxMarks} />
                          <div className="grid gap-1">
                            <Label htmlFor={`marks-${s.id}`} className="text-[11px] text-muted-foreground">
                              Marks / {assignment.maxMarks}
                            </Label>
                            <Input
                              id={`marks-${s.id}`}
                              className="h-8 w-20"
                              type="number"
                              name="marks"
                              min={0}
                              max={assignment.maxMarks}
                              step={1}
                              required
                              defaultValue={s.marks ?? undefined}
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label htmlFor={`feedback-${s.id}`} className="text-[11px] text-muted-foreground">
                              Feedback
                            </Label>
                            <Input
                              id={`feedback-${s.id}`}
                              className="h-8 w-40"
                              name="feedback"
                              maxLength={2000}
                              placeholder="Optional"
                              defaultValue={s.feedback ?? ""}
                            />
                          </div>
                          <SubmitButton
                            size="sm"
                            variant={s.gradedAt ? "outline" : "default"}
                            pendingLabel="Saving…"
                          >
                            {s.gradedAt ? "Update" : "Grade"}
                          </SubmitButton>
                        </form>
                        {s.gradedAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Graded {fmtDateTime(s.gradedAt)}
                            {s.gradedBy ? ` by ${s.gradedBy.name}` : ""}
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {notSubmitted.length > 0 ? (
            <div className="border-t border-border pt-3">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Not yet submitted ({notSubmitted.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {notSubmitted.map((s) => (
                  <Badge key={s.id} variant="outline" className="font-normal text-muted-foreground">
                    {s.name} · {s.registrationNo}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
