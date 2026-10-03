import Link from "next/link";
import { Boxes, FileText, HardDrive } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMyAllocations, listMyRequests } from "@/server/services/resources";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cancelRequestAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MyResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireUser();
  const { created } = await searchParams;

  let requests: Awaited<ReturnType<typeof listMyRequests>> = [];
  let allocations: Awaited<ReturnType<typeof listMyAllocations>> = [];
  let dbError = false;
  try {
    [requests, allocations] = await Promise.all([listMyRequests(user), listMyAllocations(user)]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        icon={HardDrive}
        title="My Allocations"
        description="Resource requests you've filed and what's allocated."
      />

      {created ? (
        <Alert variant="success">
          <AlertTitle>Request submitted</AlertTitle>
          <AlertDescription>You&apos;ll be notified when the FYP Head reviews it.</AlertDescription>
        </Alert>
      ) : null}

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Resource data unavailable</AlertTitle>
          <AlertDescription>
            The database did not answer — check DATABASE_URL and the Neon project.
          </AlertDescription>
        </Alert>
      ) : null}

      {!dbError && (requests.length > 0 || allocations.length > 0) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="My requests"
            value={requests.length}
            hint="Filed via the request form"
            icon={FileText}
            tone="primary"
          />
          <StatCard
            label="Active allocations"
            value={allocations.length}
            hint="Time-boxed compute resources"
            icon={Boxes}
            tone={allocations.length > 0 ? "success" : "default"}
          />
        </section>
      ) : null}

      {!dbError ? (
        requests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No requests yet"
            description="Start from the Request GPU / Lab page — the FYP Head reviews and allocates."
            action={
              <Button asChild>
                <Link href="/resources/request">Request resources</Link>
              </Button>
            }
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Project</TableHead>
                    <TableHead>Config</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5 font-medium">{r.projectName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.resourceType} · {r.config}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                        {r.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                        <br />
                        <span className="text-muted-foreground">{r.timeSlot}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {r.status === "PENDING" || r.status === "RECOMMENDED" ? (
                          <ConfirmAction
                            action={cancelRequestAction}
                            values={{ id: r.id }}
                            title="Cancel this request?"
                            description="It will be withdrawn from the review queue — you can submit a new one any time."
                            confirmLabel="Cancel request"
                            variant="destructive"
                            trigger={
                              <Button variant="ghost" size="sm">
                                Cancel
                              </Button>
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : null}

      {!dbError ? (
        allocations.length === 0 ? (
          <EmptyState
            compact
            icon={Boxes}
            title="Nothing allocated yet"
            description="Approved requests appear here once the FYP Head allocates a resource."
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Resource</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Lab</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5">
                        <span className="font-medium">{a.resource.model}</span>{" "}
                        <span className="text-xs text-muted-foreground">({a.resource.specs})</span>
                      </TableCell>
                      <TableCell>{a.request.projectName}</TableCell>
                      <TableCell className="text-xs">
                        {a.startDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} –{" "}
                        {a.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>{a.lab ? `Lab ${a.lab.number}` : "—"}</TableCell>
                      <TableCell className="pr-5">
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : null}

      <Alert variant="muted">
        <AlertTitle>Tip</AlertTitle>
        <AlertDescription>
          Allocations decrement live inventory — the dashboard shows GPU utilisation in real time.
        </AlertDescription>
      </Alert>
    </>
  );
}
