import Link from "next/link";
import { BookOpen, CheckCircle2, ClipboardList, GraduationCap, Inbox, PenLine, UserCheck, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listFypQueue, listSupervisors } from "@/server/services/fyp";
import { listAllMentorProfiles } from "@/server/services/mentorship";
import { decideFypAction, requestChangesFypAction } from "@/app/(portal)/fyp/actions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { StatTone } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

const FIELD =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * FYP Head console — the request desk. Applications arrive here the moment a
 * group submits them; approving one also assigns the supervisor (the student
 * and the faculty member are both notified), rejecting one records why.
 */
export default async function FypHeadPage() {
  await requireCapability("fyp.decide");

  let queue: Awaited<ReturnType<typeof listFypQueue>> = [];
  let supervisors: Awaited<ReturnType<typeof listSupervisors>> = [];
  let mentorsAwaiting = 0;
  let dbError = false;
  try {
    [queue, supervisors, mentorsAwaiting] = await Promise.all([
      listFypQueue(),
      listSupervisors(),
      listAllMentorProfiles().then((profiles) => profiles.filter((p) => !p.isApproved).length),
    ]);
  } catch {
    dbError = true;
  }

  const pending = queue.filter((q) => q.status === "PENDING");
  const approved = queue.filter((q) => q.status === "APPROVED");
  const rejected = queue.filter((q) => q.status === "REJECTED");
  const changesRequested = queue.filter((q) => q.status === "CHANGES_REQUESTED");

  const tiles: { label: string; value: number; hint: string; icon: LucideIcon; tone: StatTone }[] = [
    { label: "Requests waiting", value: pending.length, hint: pending.length ? "Decide and assign a supervisor" : "Inbox is clear", icon: Inbox, tone: pending.length ? "warning" : "success" },
    { label: "Approved groups", value: approved.length, hint: "Supervised this cycle", icon: CheckCircle2, tone: "success" },
    { label: "Rejected", value: rejected.length, hint: "With recorded reasons", icon: XCircle, tone: "default" },
    { label: "Mentors awaiting approval", value: mentorsAwaiting, hint: "Mentor profiles to review", icon: UserCheck, tone: mentorsAwaiting ? "info" : "default" },
  ];

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="FYP Head Console"
        description="Every FYP request lands here. Approve with a supervisor assignment, or reject with a reason — the group and the supervisor are notified automatically."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/mentors">
                <UserCheck className="h-4 w-4" />
                Mentor approvals
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/fyp">
                <ClipboardList className="h-4 w-4" />
                Full archive
              </Link>
            </Button>
          </>
        }
      />

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Requests unavailable</AlertTitle>
          <AlertDescription>The database didn&apos;t answer — try again in a moment.</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="FYP numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatCard key={t.label} {...t} />
        ))}
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex-row items-center justify-between gap-2 border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            Request inbox
          </CardTitle>
          <Badge variant="secondary">{pending.length} pending</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-3">
          {pending.length === 0 ? (
            <EmptyState icon={Inbox} title="No pending requests" description="New FYP submissions appear here immediately with the group's registration numbers." />
          ) : (
            pending.map((a) => (
              <article key={a.id} className="notif-item">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{a.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.groupName} · {a.members} · Reg. nos {a.registrationNos}
                    </p>
                    <p className="mt-2 max-w-3xl text-[13px] leading-6">{a.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline">{a.domain}</Badge>
                      <span>{a.technologies}</span>
                      <span>· {a.department}, {a.semester}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Submitted by <span className="font-medium text-foreground">{a.applicant.name}</span>
                      {a.applicant.registrationNo ? ` (${a.applicant.registrationNo})` : ""} · {a.applicant.email}
                      {a.supervisorPref ? ` · prefers ${a.supervisorPref}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <ConfirmAction
                      action={decideFypAction}
                      values={{ id: a.id, decision: "APPROVED" }}
                      title={`Approve “${a.title}”?`}
                      description="Assign the faculty supervisor who will take this group. The group and the supervisor are notified right away."
                      confirmLabel="Approve & assign"
                      trigger={
                        <Button type="button" size="sm">
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      }
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`sup-${a.id}`}>Supervisor</Label>
                        <select id={`sup-${a.id}`} name="supervisorId" required defaultValue="" className={FIELD}>
                          <option value="" disabled>
                            Select faculty…
                          </option>
                          {supervisors.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.employeeId ? ` (${s.employeeId})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`note-${a.id}`}>Note for the group (optional)</Label>
                        <Textarea id={`note-${a.id}`} name="remarks" rows={2} placeholder="e.g. Keep the scope to one AI model first." />
                      </div>
                    </ConfirmAction>
                    <ConfirmAction
                      action={decideFypAction}
                      values={{ id: a.id, decision: "REJECTED" }}
                      title={`Reject “${a.title}”?`}
                      description="The group is notified with your reason — they can revise and resubmit."
                      confirmLabel="Reject request"
                      reason={{ name: "remarks", label: "Reason", placeholder: "Out of scope for this cycle…", required: true }}
                      trigger={
                        <Button type="button" variant="outline" size="sm">
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      }
                    />
                    <ConfirmAction
                      action={requestChangesFypAction}
                      values={{ id: a.id }}
                      title={`Ask “${a.title}” for corrections?`}
                      description="The group keeps their place in the queue and is notified with your notes; you can approve or reject once they revise."
                      confirmLabel="Request changes"
                      reason={{ name: "remarks", label: "What needs fixing", placeholder: "Add a clearer scope and the dataset source…", required: true }}
                      trigger={
                        <Button type="button" variant="secondary" size="sm">
                          <PenLine className="h-4 w-4" />
                          Request changes
                        </Button>
                      }
                    />
                  </div>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Decided requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {approved.length + rejected.length + changesRequested.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Project</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Decided by</TableHead>
                    <TableHead className="pr-5">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...changesRequested, ...approved, ...rejected].map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5">
                        <span className="font-medium">{a.title}</span>
                        <p className="text-[11px] text-muted-foreground">{a.domain}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.groupName}
                        <p className="text-[11px] text-muted-foreground">{a.registrationNos}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.supervisor ? (
                          <>
                            {a.supervisor.name}
                            {a.supervisor.employeeId ? <p className="text-[11px] text-muted-foreground">{a.supervisor.employeeId}</p> : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.decidedBy?.name ?? "—"}</TableCell>
                      <TableCell className="max-w-[18rem] pr-5 text-[13px] text-muted-foreground">{a.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
