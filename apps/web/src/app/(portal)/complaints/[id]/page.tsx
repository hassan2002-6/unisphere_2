import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getComplaint } from "@/server/services/complaints";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
    <main className="space-y-4 p-6">
      {created ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Complaint filed — you&apos;ll be notified as it progresses.
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{complaint.subject}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{complaint.category}</Badge>
          <StatusBadge status={complaint.status} />
          {complaint.assignedTo ? <span>handled by {complaint.assignedTo.name}</span> : null}
        </p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{complaint.description}</CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Filed by {complaint.submittedBy.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {complaint.events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">
                <StatusBadge status={e.status} />
              </div>
              <div>
                <p>
                  <span className="font-medium">{e.actor?.name ?? "System"}</span>
                  {e.comment ? <span className="text-muted-foreground"> — {e.comment}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <Separator />
          <p className="text-xs text-muted-foreground">
            Filed{" "}
            {complaint.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
