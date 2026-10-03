import { notFound } from "next/navigation";
import { FileText, History, MessageSquareWarning } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getComplaint } from "@/server/services/complaints";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ComplaintDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;

  let complaint: Awaited<ReturnType<typeof getComplaint>> | null = null;
  try {
    complaint = await getComplaint(user, id);
  } catch {
    complaint = null;
  }
  if (!complaint) notFound();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Complaint Box", href: "/complaints" }, { label: complaint.subject }]}
        icon={MessageSquareWarning}
        title={complaint.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{complaint.category}</Badge>
            <StatusBadge status={complaint.status} />
            {complaint.assignedTo ? <span>handled by {complaint.assignedTo.name}</span> : null}
          </span>
        }
      />

      {created ? (
        <Alert variant="success">
          <AlertTitle>Complaint filed</AlertTitle>
          <AlertDescription>You&apos;ll be notified as it progresses.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Description
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">{complaint.description}</CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            History
          </CardTitle>
          <CardDescription>Filed by {complaint.submittedBy.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {complaint.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-border pl-5">
              {complaint.events.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={e.status} />
                    <span className="text-xs text-muted-foreground">
                      {e.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{e.actor?.name ?? "System"}</span>
                    {e.comment ? <span className="text-muted-foreground"> — {e.comment}</span> : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Filed{" "}
            {complaint.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
