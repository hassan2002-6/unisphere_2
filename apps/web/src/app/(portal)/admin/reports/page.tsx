import { requireCapability } from "@/lib/auth";
import { getSummary } from "@/server/services/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function StatusBlock({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{k.replaceAll("_", " ").toLowerCase()}</span>
              <span className="font-medium tabular-nums">{v}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminReportsPage() {
  await requireCapability("reports.view");

  let summary: Awaited<ReturnType<typeof getSummary>> | null = null;
  try {
    summary = await getSummary();
  } catch {
    summary = null;
  }

  if (!summary) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reports unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Live operational counts — everything here is computed from the same database the app runs on.
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href="/api/reports/summary?format=csv" download>
            Download CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatusBlock title="Users by role" counts={summary.usersByRole} />
        <StatusBlock title="Forms by status" counts={summary.formsByStatus} />
        <StatusBlock title="Complaints by status" counts={summary.complaintsByStatus} />
        <StatusBlock title="FYP applications" counts={summary.fypByStatus} />
        <StatusBlock title="Resource requests" counts={summary.requestsByStatus} />
        <StatusBlock title="Allocations" counts={summary.allocationsByStatus} />
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Resource utilization</CardTitle>
          <CardDescription>In-use share of each inventory line, live.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Free</TableHead>
                <TableHead>In use</TableHead>
                <TableHead className="w-64">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.resources.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">
                    {r.name} <span className="text-xs text-muted-foreground">({r.model})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.type}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.available}/{r.quantity}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.inUse}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-2 w-40 overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${r.utilizationPct >= 80 ? "bg-destructive" : r.utilizationPct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${r.utilizationPct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{r.utilizationPct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4 text-sm">
            <p className="text-muted-foreground">Open internships</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.internshipsOpen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-sm">
            <p className="text-muted-foreground">Approved mentors</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.mentorsApproved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-sm">
            <p className="text-muted-foreground">Labs tracked</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.labs.length}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
