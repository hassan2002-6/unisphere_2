import { BarChart3, Briefcase, Download, FlaskConical } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getSummary } from "@/server/services/reports";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function StatusBlock({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-3.5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="px-5 py-5">
            <EmptyState compact icon={BarChart3} title="No data yet" description="Counts appear as soon as records exist." />
          </div>
        ) : (
          <ul className="divide-y">
            {entries.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="text-muted-foreground">{k.replaceAll("_", " ").toLowerCase()}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
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
      <>
        <PageHeader
          icon={BarChart3}
          title="Reports"
          description="Live operational counts — everything here is computed from the same database the app runs on."
        />
        <Alert variant="destructive">
          <AlertTitle>Reports unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Reports"
        description="Live operational counts — everything here is computed from the same database the app runs on."
        actions={
          <Button asChild variant="secondary">
            <a href="/api/reports/summary?format=csv" download>
              <Download className="h-4 w-4" />
              Download CSV
            </a>
          </Button>
        }
      />

      <section aria-label="Status breakdowns" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusBlock title="Users by role" counts={summary.usersByRole} />
        <StatusBlock title="Forms by status" counts={summary.formsByStatus} />
        <StatusBlock title="Complaints by status" counts={summary.complaintsByStatus} />
        <StatusBlock title="FYP applications" counts={summary.fypByStatus} />
        <StatusBlock title="Resource requests" counts={summary.requestsByStatus} />
        <StatusBlock title="Allocations" counts={summary.allocationsByStatus} />
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="text-sm font-semibold">Resource utilization</CardTitle>
          <CardDescription>In-use share of each inventory line, live.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Free</TableHead>
                <TableHead>In use</TableHead>
                <TableHead className="w-64 pr-5">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.resources.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="pl-5 font-medium">
                    {r.name} <span className="text-xs text-muted-foreground">({r.model})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.type}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.available}/{r.quantity}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.inUse}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-2 w-40 overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${r.utilizationPct >= 80 ? "bg-destructive" : r.utilizationPct >= 50 ? "bg-warning" : "bg-success"}`}
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

      <section aria-label="Programme numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Open internships" value={summary.internshipsOpen} icon={Briefcase} tone="info" />
        <StatCard label="Labs tracked" value={summary.labs.length} icon={FlaskConical} tone="primary" />
      </section>
    </>
  );
}
