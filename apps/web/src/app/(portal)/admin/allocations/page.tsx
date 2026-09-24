import { requireCapability } from "@/lib/auth";
import { listAllAllocations } from "@/server/services/resources";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { closeAllocationAction } from "../../resources/actions";

export const dynamic = "force-dynamic";

export default async function AdminAllocationsPage() {
  await requireCapability("resources.manage");

  let allocations: Awaited<ReturnType<typeof listAllAllocations>> | null = null;
  try {
    allocations = await listAllAllocations();
  } catch {
    allocations = null;
  }

  if (!allocations) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocations unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const active = allocations.filter((a) => a.status === "ACTIVE");
  const closed = allocations.filter((a) => a.status !== "ACTIVE");

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Allocations</h1>
        <p className="text-sm text-muted-foreground">
          {active.length} active · {closed.length} closed. Revoking returns the unit to the pool.
        </p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Active allocations ({active.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing active right now.</p>
          ) : (
            <div className="space-y-3">
              {active.map((a) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium">{a.resource.name}</span>{" "}
                      <span className="text-muted-foreground">
                        · {a.request.projectName} · {a.request.applicant.name}
                        {a.lab ? ` · Lab ${a.lab.number}` : ""}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {a.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                        {a.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                        {a.timeSlot}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <form action={closeAllocationAction} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <Input name="notes" placeholder="Closing note (optional)" className="h-8 max-w-sm text-sm" />
                    <Button type="submit" name="action" value="COMPLETED" variant="secondary" size="sm">
                      Complete
                    </Button>
                    <Button type="submit" name="action" value="REVOKED" variant="destructive" size="sm">
                      Revoke
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">History ({closed.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.resource.model}</TableCell>
                    <TableCell>{a.request.projectName}</TableCell>
                    <TableCell>{a.request.applicant.name}</TableCell>
                    <TableCell className="text-xs">
                      {a.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                      {a.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
