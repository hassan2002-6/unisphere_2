import { Activity, Archive, Check, Server, X } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listAllAllocations } from "@/server/services/resources";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <>
        <PageHeader icon={Server} title="Allocations" />
        <Alert variant="destructive">
          <AlertTitle>Allocations unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const active = allocations.filter((a) => a.status === "ACTIVE");
  const closed = allocations.filter((a) => a.status !== "ACTIVE");

  return (
    <>
      <PageHeader
        icon={Server}
        title="Allocations"
        description={`${active.length} active · ${closed.length} closed. Revoking returns the unit to the pool.`}
      />

      {allocations.length > 0 ? (
        <section aria-label="Allocation summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total allocations" value={allocations.length} icon={Server} tone="primary" />
          <StatCard
            label="Active"
            value={active.length}
            hint={active.length ? "In use right now" : "Nothing active"}
            icon={Activity}
            tone={active.length ? "success" : "default"}
          />
          <StatCard
            label="Closed"
            value={closed.length}
            hint={closed.length ? "Completed or revoked" : "No history yet"}
            icon={Archive}
            tone="default"
          />
        </section>
      ) : null}

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="text-sm font-semibold">Active allocations ({active.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <div className="px-5 py-5">
              <EmptyState
                compact
                icon={Server}
                title="Nothing active right now"
                description="Allocations appear here the moment a recommended request is given real inventory."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {active.map((a) => (
                <li key={a.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5 text-sm">
                      <p>
                        <span className="font-medium">{a.resource.name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {a.request.projectName} · {a.request.applicant.name}
                          {a.lab ? ` · Lab ${a.lab.number}` : ""}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                        {a.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                        {a.timeSlot}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfirmAction
                      action={closeAllocationAction}
                      values={{ id: a.id, action: "COMPLETED" }}
                      title="Complete this allocation?"
                      description="Marks the allocation as completed and returns the unit to the pool."
                      confirmLabel="Mark complete"
                      trigger={
                        <Button variant="secondary" size="sm">
                          <Check className="h-4 w-4" />
                          Complete
                        </Button>
                      }
                      reason={{ name: "notes", label: "Closing note (optional)", required: false }}
                    />
                    <ConfirmAction
                      action={closeAllocationAction}
                      values={{ id: a.id, action: "REVOKED" }}
                      title="Revoke this allocation?"
                      description="Returns the unit to the pool immediately."
                      confirmLabel="Revoke"
                      variant="destructive"
                      trigger={
                        <Button variant="destructive" size="sm">
                          <X className="h-4 w-4" />
                          Revoke
                        </Button>
                      }
                      reason={{ name: "notes", label: "Closing note (optional)", required: false }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">History ({closed.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Resource</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead className="pr-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-5 font-medium">{a.resource.model}</TableCell>
                    <TableCell>{a.request.projectName}</TableCell>
                    <TableCell>{a.request.applicant.name}</TableCell>
                    <TableCell className="text-xs">
                      {a.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                      {a.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="pr-5">
                      <StatusBadge status={a.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
