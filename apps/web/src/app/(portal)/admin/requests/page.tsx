import { Cpu, Inbox, Server, ThumbsDown, ThumbsUp } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listLabs, listRequestQueue, listResources } from "@/server/services/resources";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { allocateAction, recommendAction, rejectRequestAction } from "../../resources/actions";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireCapability("resources.manage");

  let queue: Awaited<ReturnType<typeof listRequestQueue>> = [];
  let resources: Awaited<ReturnType<typeof listResources>> = [];
  let labs: Awaited<ReturnType<typeof listLabs>> = [];
  let dbError = false;
  try {
    [queue, resources, labs] = await Promise.all([listRequestQueue(), listResources(), listLabs()]);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <>
        <PageHeader
          icon={Cpu}
          title="Resource Requests"
          description="Recommend, then allocate real inventory — availability decrements atomically."
        />
        <Alert variant="destructive">
          <AlertTitle>Requests unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Cpu}
        title="Resource Requests"
        description="Recommend, then allocate real inventory — availability decrements atomically."
      />

      {queue.length === 0 ? (
        <EmptyState icon={Inbox} title="No open requests" description="New GPU/lab requests will land here for review." />
      ) : (
        <div className="space-y-4">
          {queue.map((r) => (
            <Card key={r.id} className="gap-0 overflow-hidden py-0">
              <CardHeader className="border-b px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{r.projectName}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {r.resourceType} · {r.config}
                    </Badge>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <CardDescription>
                  {r.applicant.name}
                  {r.applicant.registrationNo ? ` · ${r.applicant.registrationNo}` : ""} · {r.groupName} ·{" "}
                  {r.members}
                  {r.supervisor ? ` · supervisor: ${r.supervisor}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-4">
                <p className="text-sm text-muted-foreground">{r.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  Window:{" "}
                  {r.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                  {r.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                  {r.timeSlot}
                  {r.remarks ? ` · remarks: ${r.remarks}` : ""}
                </p>

                {r.status === "PENDING" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfirmAction
                      action={recommendAction}
                      values={{ id: r.id }}
                      title={`Recommend "${r.projectName}"?`}
                      description="Moves the request to the allocation step."
                      confirmLabel="Recommend"
                      trigger={
                        <Button size="sm">
                          <ThumbsUp className="h-4 w-4" />
                          Recommend
                        </Button>
                      }
                      reason={{ name: "remarks", label: "Remarks (optional)", required: false }}
                    />
                    <ConfirmAction
                      action={rejectRequestAction}
                      values={{ id: r.id }}
                      title={`Reject "${r.projectName}"?`}
                      description="The requester is notified immediately."
                      confirmLabel="Reject"
                      variant="destructive"
                      trigger={
                        <Button variant="destructive" size="sm">
                          <ThumbsDown className="h-4 w-4" />
                          Reject
                        </Button>
                      }
                      reason={{ name: "remarks", label: "Remarks (optional)", required: false }}
                    />
                  </div>
                ) : null}

                {r.status === "RECOMMENDED" ? (
                  <ConfirmAction
                    action={allocateAction}
                    values={{ id: r.id }}
                    title={`Allocate "${r.projectName}"`}
                    description="Reserves inventory right away — availability decrements atomically."
                    confirmLabel="Allocate"
                    trigger={
                      <Button size="sm">
                        <Server className="h-4 w-4" />
                        Allocate
                      </Button>
                    }
                    reason={{ name: "notes", label: "Allocation notes", required: false }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`resource-${r.id}`}>Resource</Label>
                        <select
                          id={`resource-${r.id}`}
                          name="resourceId"
                          required
                          className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        >
                          <option value="">Pick resource…</option>
                          {resources.map((res) => (
                            <option key={res.id} value={res.id} disabled={res.available <= 0}>
                              {res.name} — {res.available}/{res.quantity} free
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`lab-${r.id}`}>Lab (optional)</Label>
                        <select
                          id={`lab-${r.id}`}
                          name="labId"
                          className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        >
                          <option value="">No lab</option>
                          {labs.map((l) => (
                            <option key={l.id} value={l.id}>
                              Lab {l.number} — {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </ConfirmAction>
                ) : null}

                {r.allocation ? (
                  <Alert variant="success">
                    <AlertTitle>
                      Allocated {r.allocation.resource.name}
                      {r.allocation.lab ? ` in Lab ${r.allocation.lab.number}` : ""}
                    </AlertTitle>
                    <AlertDescription>
                      Active until{" "}
                      {r.allocation.endDate.toLocaleDateString("en-GB", {
                        timeZone: "UTC",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
