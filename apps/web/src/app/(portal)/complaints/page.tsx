import Link from "next/link";
import { MessageSquareWarning, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMyComplaints } from "@/server/services/complaints";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const user = await requireUser();

  let data: Awaited<ReturnType<typeof listMyComplaints>> | null = null;
  try {
    data = await listMyComplaints(user);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title="Complaint Box" />
        <Alert variant="destructive">
          <AlertTitle>Complaint Box unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check DATABASE_URL and the Neon project.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={MessageSquareWarning}
        title="Complaint Box"
        description="File complaints and track them — routed to faculty or the coordination office."
        actions={
          <Button asChild>
            <Link href="/complaints/new">
              <Plus className="h-4 w-4" />
              File a complaint
            </Link>
          </Button>
        }
      />

      {data.items.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title="No complaints filed"
          description="Hopefully it stays that way! If something needs fixing, file a complaint and track it here."
          action={
            <Button asChild>
              <Link href="/complaints/new">File a complaint</Link>
            </Button>
          }
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5 font-medium">{c.subject}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/complaints/${c.id}`}>Track</Link>
                      </Button>
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
