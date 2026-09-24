import { requireCapability } from "@/lib/auth";
import { listLabs, listRequestQueue, listResources } from "@/server/services/resources";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resource Requests</h1>
        <p className="text-sm text-muted-foreground">
          Recommend, then allocate real inventory — availability decrements atomically.
        </p>
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : queue.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No open requests</CardTitle>
            <CardDescription>New GPU/lab requests will land here for review.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((r) => (
            <Card key={r.id}>
              <CardHeader className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{r.projectName}</CardTitle>
                  <div className="flex items-center gap-2">
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
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{r.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  Window:{" "}
                  {r.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                  {r.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                  {r.timeSlot}
                  {r.remarks ? ` · remarks: ${r.remarks}` : ""}
                </p>

                {r.status === "PENDING" ? (
                  <form className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="min-w-64 flex-1">
                      <Input name="remarks" placeholder="Remarks (optional)" className="h-9" />
                    </div>
                    <Button formAction={recommendAction} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      Recommend
                    </Button>
                    <Button formAction={rejectRequestAction} variant="destructive" size="sm">
                      Reject
                    </Button>
                  </form>
                ) : null}

                {r.status === "RECOMMENDED" ? (
                  <form action={allocateAction} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground">Resource</label>
                      <select
                        name="resourceId"
                        required
                        className="border-input h-9 min-w-56 rounded-md border bg-transparent px-3 text-sm"
                      >
                        <option value="">Pick resource…</option>
                        {resources.map((res) => (
                          <option key={res.id} value={res.id} disabled={res.available <= 0}>
                            {res.name} — {res.available}/{res.quantity} free
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground">Lab (optional)</label>
                      <select name="labId" className="border-input h-9 min-w-40 rounded-md border bg-transparent px-3 text-sm">
                        <option value="">No lab</option>
                        {labs.map((l) => (
                          <option key={l.id} value={l.id}>
                            Lab {l.number} — {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-48 flex-1">
                      <Input name="notes" placeholder="Allocation notes" className="h-9" />
                    </div>
                    <Button type="submit" size="sm">
                      Allocate
                    </Button>
                  </form>
                ) : null}

                {r.allocation ? (
                  <p className="text-xs text-emerald-700">
                    Allocated {r.allocation.resource.name}
                    {r.allocation.lab ? ` in Lab ${r.allocation.lab.number}` : ""} — active until{" "}
                    {r.allocation.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
