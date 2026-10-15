import Link from "next/link";
import { ArrowLeft, ClipboardList, Download, FileText, TriangleAlert, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { MAX_FILE_BYTES, ServiceError, getMyAssignment, normaliseAllowedTypes } from "@/server/services/assignments";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitAssignmentAction } from "../actions";

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

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { submitted, error } = await searchParams;

  let assignment: Awaited<ReturnType<typeof getMyAssignment>> | null = null;
  let loadError: string | null = null;
  try {
    assignment = await getMyAssignment(user, id);
  } catch (e) {
    loadError = e instanceof ServiceError ? e.message : "Something went wrong loading this assignment.";
  }

  if (!assignment) {
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

  const submission = assignment.submissions[0] ?? null;
  const graded = Boolean(submission?.gradedAt);
  const open = !assignment.closedAt;
  const now = new Date();
  const past = assignment.deadline.getTime() < now.getTime();
  const allowed = normaliseAllowedTypes(assignment.allowedTypes);
  const accept = allowed.map((t) => `.${t}`).join(",");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Assignments", href: "/assignments" }, { label: assignment.title }]}
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
            {graded ? (
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
            {assignment.closedAt ? <StatusBadge status="CLOSED" /> : null}
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/assignments">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      {submitted ? (
        <Alert variant="success">
          <AlertTitle>Submission received</AlertTitle>
          <AlertDescription>
            Your latest file replaces any earlier upload. You can resubmit until the assignment is graded.
            {submission?.isLate ? " This submission was flagged late because it arrived after the deadline." : ""}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Submission not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {past && open && !graded ? (
        <Alert variant="warning">
          <AlertTitle>Past the deadline</AlertTitle>
          <AlertDescription>
            Late submissions are accepted but flagged as late — your instructor sees the flag.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Instructions
            </CardTitle>
            <CardDescription>
              Posted by {assignment.createdBy.name} · due {fmtDateTime(assignment.deadline)} (
              {dueHint(assignment.deadline, now)})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{assignment.instructions}</p>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Accepted file types: {allowed.join(", ")}</span>
              <span aria-hidden>·</span>
              <span>Max {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB per file</span>
            </div>
            {assignment.attachmentName ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/api/assignments/${assignment.id}/attachment`}>
                  <Download className="h-3.5 w-3.5" />
                  {assignment.attachmentName}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Your submission
            </CardTitle>
            <CardDescription>
              One submission per assignment — a resubmission replaces your previous file until it is graded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission ? (
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/api/assignments/submissions/${submission.id}/file`}>
                      <Download className="h-3.5 w-3.5" />
                      {submission.fileName}
                    </Link>
                  </Button>
                  {submission.isLate ? <StatusBadge status="LATE" /> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Attempt {submission.attempt} · submitted {fmtDateTime(submission.submittedAt)}
                </p>
                {submission.note ? (
                  <p className="text-xs text-muted-foreground">Note: {submission.note}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
            )}

            {graded ? (
              <div className="space-y-2 rounded-lg border border-success/25 bg-success/10 px-3.5 py-3">
                <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Marks</p>
                <p className="text-2xl font-bold text-success tabular-nums">
                  {submission?.marks ?? 0}
                  <span className="text-sm font-medium text-muted-foreground">/{assignment.maxMarks}</span>
                </p>
                {submission?.feedback ? (
                  <p className="text-sm leading-6 whitespace-pre-wrap">{submission.feedback}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Graded {submission?.gradedAt ? fmtDateTime(submission.gradedAt) : ""} · resubmission closed — contact
                  your instructor to reopen it.
                </p>
              </div>
            ) : null}

            {graded ? null : !open ? (
              <Alert variant="warning">
                <AlertTitle>Assignment closed</AlertTitle>
                <AlertDescription>
                  Submissions are no longer accepted for this assignment. Contact your instructor if you are affected.
                </AlertDescription>
              </Alert>
            ) : (
              <form action={submitAssignmentAction} className="grid gap-3 border-t border-border pt-3">
                <input type="hidden" name="id" value={assignment.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor="file">{submission ? "Replace with a new file" : "Submission file"}</Label>
                  <Input id="file" name="file" type="file" required accept={accept} className="h-9 py-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {allowed.join(", ")} — max {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="note">Note for your instructor (optional)</Label>
                  <Textarea
                    id="note"
                    name="note"
                    rows={3}
                    maxLength={1000}
                    placeholder="Anything the marker should know…"
                  />
                </div>
                <SubmitButton pendingLabel={submission ? "Resubmitting…" : "Submitting…"} className="w-fit">
                  {submission ? "Resubmit file" : "Submit assignment"}
                </SubmitButton>
                {past ? (
                  <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    The deadline has passed — your {submission ? "resubmission" : "submission"} will be flagged late.
                  </p>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
