import { Check, CheckCircle2, Clock, GraduationCap, Inbox, X } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listFypQueue } from "@/server/services/fyp";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { decideFypAction } from "@/app/(portal)/fyp/actions";

export const dynamic = "force-dynamic";

export default async function AdminFypPage() {
  await requireCapability("fyp.decide");

  let queue: Awaited<ReturnType<typeof listFypQueue>> | null = null;
  try {
    queue = await listFypQueue();
  } catch {
    queue = null;
  }

  if (!queue) {
    return (
      <>
        <PageHeader icon={GraduationCap} title="FYP Applications" />
        <Alert variant="destructive">
          <AlertTitle>FYP queue unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const pending = queue.filter((q) => q.status === "PENDING");
  const decided = queue.filter((q) => q.status !== "PENDING");

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="FYP Applications"
        description={`${pending.length} pending · ${decided.length} decided — decisions notify the applicants immediately.`}
      />

      {queue.length > 0 ? (
        <section aria-label="Queue summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total applications" value={queue.length} icon={GraduationCap} tone="primary" />
          <StatCard
            label="Pending decisions"
            value={pending.length}
            hint={pending.length ? "Awaiting your review" : "Queue is clear"}
            icon={Clock}
            tone={pending.length ? "warning" : "default"}
          />
          <StatCard
            label="Decided"
            value={decided.length}
            hint={decided.length ? "Approved or rejected" : "No decisions yet"}
            icon={CheckCircle2}
            tone={decided.length ? "success" : "default"}
          />
        </section>
      ) : null}

      {pending.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing pending"
          description="New applications will appear here for a decision."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((a) => (
            <Card key={a.id} className="gap-0 overflow-hidden py-0">
              <CardHeader className="border-b px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{a.title}</CardTitle>
                  <StatusBadge status={a.status} />
                </div>
                <CardDescription>
                  {a.applicant.name} · {a.groupName} · {a.members} ({a.registrationNos}) · {a.department}, {a.semester}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-4">
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground">
                  Domain: {a.domain} · Tech: {a.technologies}
                  {a.supervisorPref ? ` · Supervisor pref: ${a.supervisorPref}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <ConfirmAction
                    action={decideFypAction}
                    values={{ id: a.id, decision: "APPROVED" }}
                    title={`Approve "${a.title}"?`}
                    description="The applicant is notified immediately."
                    confirmLabel="Approve"
                    trigger={
                      <Button size="sm">
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                    }
                    reason={{ name: "remarks", label: "Remarks (included in the notification)", required: false }}
                  />
                  <ConfirmAction
                    action={decideFypAction}
                    values={{ id: a.id, decision: "REJECTED" }}
                    title={`Reject "${a.title}"?`}
                    description="The applicant is notified immediately."
                    confirmLabel="Reject"
                    variant="destructive"
                    trigger={
                      <Button variant="destructive" size="sm">
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    }
                    reason={{ name: "remarks", label: "Remarks (included in the notification)", required: false }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">Decided ({decided.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {decided.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{a.title}</span>{" "}
                      <span className="text-muted-foreground">· {a.applicant.name} · {a.groupName}</span>
                    </p>
                    {a.remarks ? <p className="text-xs text-muted-foreground">Remarks: {a.remarks}</p> : null}
                    {a.supervisor ? (
                      <p className="text-xs text-muted-foreground">
                        Supervisor: <span className="font-medium text-foreground">{a.supervisor.name}</span>
                        {a.supervisor.employeeId ? ` · ${a.supervisor.employeeId}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.decidedBy ? <Badge variant="outline">by {a.decidedBy.name}</Badge> : null}
                    <StatusBadge status={a.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
