import Link from "next/link";
import { CheckCircle2, ClipboardList, Clock, FilePlus2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMySubmissions } from "@/server/services/forms";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; withdrawn?: string }>;
}) {
  const user = await requireUser();
  const { submitted, withdrawn } = await searchParams;

  let data: Awaited<ReturnType<typeof listMySubmissions>> | null = null;
  try {
    data = await listMySubmissions(user);
  } catch (error) {
    console.error("submissions load failed:", error);
    data = null;
  }

  if (!data) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="My Submissions" />
        <Alert variant="destructive">
          <AlertTitle>Submissions unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const inProgress = data.items.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length;
  const decided = data.items.filter((s) => ["APPROVED", "REJECTED"].includes(s.status)).length;

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="My Submissions"
        description="Track every request you've filed — statuses update the moment a reviewer acts."
        actions={
          <Button asChild>
            <Link href="/forms">
              <FilePlus2 className="h-4 w-4" />
              New submission
            </Link>
          </Button>
        }
      />

      {submitted ? (
        <Alert variant="success">
          <AlertTitle>Submitted</AlertTitle>
          <AlertDescription>
            Your request is in the review queue. You&apos;ll get a notification as soon as the reviewer
            decides — track it in the table below.
          </AlertDescription>
        </Alert>
      ) : null}
      {withdrawn ? (
        <Alert variant="muted">
          <AlertTitle>Withdrawn</AlertTitle>
          <AlertDescription>The submission was withdrawn and is no longer under review.</AlertDescription>
        </Alert>
      ) : null}

      {data.items.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total submissions" value={data.items.length} icon={ClipboardList} tone="primary" />
          <StatCard
            label="In progress"
            value={inProgress}
            hint={inProgress ? "Awaiting review" : "Nothing pending"}
            icon={Clock}
            tone={inProgress ? "warning" : "default"}
          />
          <StatCard
            label="Decided"
            value={decided}
            hint={decided ? "Approved or rejected" : "No decisions yet"}
            icon={CheckCircle2}
            tone={decided ? "success" : "default"}
          />
        </section>
      ) : null}

      {data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No submissions yet"
          description="Start from the Forms Center — leave applications, certificates, NOCs and more are all digital here."
          action={
            <Button asChild>
              <Link href="/forms">Open Forms Center</Link>
            </Button>
          }
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-5 font-medium">{s.template.title}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.createdAt.toLocaleString("en-GB", {
                        timeZone: "Asia/Karachi",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/submissions/${s.id}`}>View</Link>
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
