import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { auditEntities, listAudit } from "@/server/services/audit";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function formatTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requireCapability("audit.view");
  const { entity } = await searchParams;

  let entities: string[] = [];
  let entries: Awaited<ReturnType<typeof listAudit>> = [];
  let dbError = false;

  try {
    entities = await auditEntities();
    const filter = entity && entities.includes(entity) ? entity : undefined;
    entries = await listAudit({ take: 60, ...(filter ? { entity: filter } : {}) });
  } catch (loadError) {
    console.error("audit load failed:", loadError);
    dbError = true;
  }

  const activeEntity = entity && entities.includes(entity) ? entity : "";

  return (
    <>
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        description="Every important action across the portal — form decisions, allocations, broadcasts, role changes — is written here by the server. Newest first."
        actions={
          <form className="flex flex-wrap items-center gap-2" method="get">
            <select
              name="entity"
              defaultValue={activeEntity}
              aria-label="Filter by entity"
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">All entities</option>
              {entities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {activeEntity ? (
              <Button asChild variant="ghost">
                <Link href="/admin/audit">Clear</Link>
              </Button>
            ) : null}
          </form>
        }
      />

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Audit log unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={activeEntity ? `No entries for ${activeEntity}` : "No audit entries yet"}
          description="Actions are recorded automatically the moment they happen — nothing to show for this filter yet."
          action={
            activeEntity ? (
              <Button asChild variant="outline">
                <Link href="/admin/audit">Clear filter</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="pr-5">Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-5 text-xs text-muted-foreground tabular-nums">
                      {formatTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{entry.actor?.name ?? "System"}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor ? ROLE_LABELS[entry.actor.role] : "Automated"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.entity}</TableCell>
                    <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                      {entry.summary ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
