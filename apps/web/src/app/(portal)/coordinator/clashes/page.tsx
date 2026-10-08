import { Fragment } from "react";
import { CalendarClock, CalendarDays, CircleCheck, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getClashReport, minToLabel, formatDay } from "@/server/services/schedule";
import { listClashReports } from "@/server/services/clash-reports";
import { ClashBadge } from "@/components/clash-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ClashReportKind } from "@unisphere/db";
import { resolveClash, resolveClashReportAction } from "./actions";

export const dynamic = "force-dynamic";

function clashWhen(c: { day?: string; date?: string; startMin: number; endMin: number }): string {
  const time = `${minToLabel(c.startMin)}–${minToLabel(c.endMin)}`;
  if (c.date) return `${c.date} · ${time}`;
  if (c.day) return `${formatDay(c.day)} · ${time}`;
  return time;
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" });
}

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

export default async function ClashMonitorPage() {
  const user = await requireCapability("clashes.view");

  let report: Awaited<ReturnType<typeof getClashReport>> | null = null;
  try {
    report = await getClashReport();
  } catch {
    report = null;
  }

  if (!report) {
    return (
      <>
        <PageHeader
          icon={ShieldAlert}
          title="Clash Monitor"
          description="Room, lab, faculty, section and exam clashes across the whole timetable — computed live."
        />
        <Alert variant="destructive">
          <AlertTitle>Clash monitor unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const { active, resolved } = report;

  let studentReports: Awaited<ReturnType<typeof listClashReports>> | null = null;
  try {
    studentReports = await listClashReports(user, { includeResolved: true });
  } catch {
    studentReports = null;
  }
  const openReported = studentReports?.filter((r) => r.status === "OPEN").length ?? null;

  return (
    <>
      <PageHeader
        icon={ShieldAlert}
        title="Clash Monitor"
        description="Room, lab, faculty, section and exam clashes across the whole timetable — computed live."
      />

      <section aria-label="Clash summary" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Active clashes"
          value={active.length}
          hint={active.length > 0 ? "Waiting to be acknowledged" : "Timetable is clean"}
          icon={ShieldAlert}
          tone={active.length > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Resolved clashes"
          value={resolved.length}
          hint={resolved.length > 0 ? "Logged by the timetable office" : "No resolutions logged yet"}
          icon={CircleCheck}
          tone={resolved.length > 0 ? "success" : "default"}
        />
        <StatCard
          label="Student reports open"
          value={openReported ?? "—"}
          hint={
            openReported === null
              ? "Student reports did not load"
              : openReported > 0
                ? "Waiting on a coordinator decision"
                : "Nothing in the queue"
          }
          icon={MessageSquareWarning}
          tone={openReported !== null && openReported > 0 ? "warning" : "default"}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Active clashes</h2>
        {active.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="No unresolved clashes"
            description="The timetable is clean. 🎉 New clashes appear here the moment the schedule changes."
            compact
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <ul className="divide-y">
                {active.map((c) => (
                  <li key={c.key} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ClashBadge kind={c.kind} />
                        <span className="text-sm font-medium">{c.detail}</span>
                        <span className="text-xs text-muted-foreground">{clashWhen(c)}</span>
                      </div>
                      <ConfirmAction
                        action={resolveClash}
                        values={{ key: c.key }}
                        title="Mark this clash as resolved?"
                        description="It leaves the active queue and is logged for the timetable office."
                        confirmLabel="Mark resolved"
                        reason={{ name: "note", label: "Resolution note", placeholder: "e.g. moved CS-305 to Tuesday 10:00", required: false }}
                        trigger={
                          <Button variant="secondary" size="sm">
                            Mark resolved
                          </Button>
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.a.label} <span className="mx-1">↔</span> {c.b.label}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {resolved.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Resolved</h2>
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <ul className="divide-y">
                {resolved.map(({ clash, note, resolvedBy }) => (
                  <li key={clash.key} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClashBadge kind={clash.kind} />
                      <span className="text-sm font-medium line-through">{clash.detail}</span>
                      <span className="text-xs text-muted-foreground">{clashWhen(clash)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clash.a.label} ↔ {clash.b.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Resolved by {resolvedBy}
                      {note ? `: ${note}` : " (no note)"}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Student-reported clashes</h2>
        {studentReports === null ? (
          <Alert variant="muted">
            <AlertTitle>Student reports unavailable</AlertTitle>
            <AlertDescription>The database did not answer for student-reported clashes — refresh to retry.</AlertDescription>
          </Alert>
        ) : studentReports.length === 0 ? (
          <EmptyState
            icon={MessageSquareWarning}
            title="No student-reported clashes"
            description="When a student flags a timetable or exam overlap, it appears here for you to resolve or dismiss."
            compact
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Reporter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5">Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentReports.map((r) => (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell className="pl-5">
                          <div className="flex flex-col">
                            <span className="font-medium">{r.reportedBy.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {r.reportedBy.registrationNo ?? r.reportedBy.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ReportKindBadge kind={r.kind} />
                        </TableCell>
                        <TableCell className="max-w-md whitespace-normal">{r.description}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="pr-5 max-w-xs whitespace-normal text-xs text-muted-foreground">
                          {r.status === "OPEN" ? (
                            "—"
                          ) : (
                            <>
                              {r.resolutionNote ?? "No note"}
                              {r.handledBy ? ` · ${r.handledBy.name}` : ""}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                      {r.status === "OPEN" ? (
                        <TableRow>
                          <TableCell colSpan={6} className="px-5 whitespace-normal">
                            <form action={resolveClashReportAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <input type="hidden" name="id" value={r.id} />
                              <div className="grid flex-1 gap-1.5">
                                <Label htmlFor={`note-${r.id}`} className="text-xs">
                                  Resolution note
                                </Label>
                                <Textarea
                                  id={`note-${r.id}`}
                                  name="note"
                                  required
                                  minLength={3}
                                  maxLength={1000}
                                  rows={2}
                                  className="min-h-0"
                                  placeholder="e.g. Moved the Thursday 10:00 lab slot to 14:00"
                                />
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <SubmitButton size="sm" name="status" value="RESOLVED" pendingLabel="Saving…">
                                  Resolve
                                </SubmitButton>
                                <SubmitButton size="sm" variant="outline" name="status" value="DISMISSED" pendingLabel="Saving…">
                                  Dismiss
                                </SubmitButton>
                              </div>
                            </form>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
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
