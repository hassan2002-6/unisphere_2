import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMyComplaints } from "@/server/services/complaints";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Complaint Box unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Complaint Box</h1>
          <p className="text-sm text-muted-foreground">
            File complaints and track them — routed to faculty or the coordination office.
          </p>
        </div>
        <Button asChild>
          <Link href="/complaints/new">File a complaint</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No complaints filed — hopefully it stays that way!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.subject}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/complaints/${c.id}`}>Track</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
