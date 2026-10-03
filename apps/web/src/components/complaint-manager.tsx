import { MessageSquareWarning } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ComplaintActions } from "@/components/complaint-actions";
import { complaintTransitionAction } from "@/app/(portal)/complaints/actions";

type ManagedComplaint = {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  createdAt: Date;
  submittedBy: { name: string; registrationNo: string | null };
  assignedTo: { name: string } | null;
};

/** Shared management list for /coordinator/complaints and /faculty/complaints. */
export function ComplaintManager({
  items,
  labels,
}: {
  items: ManagedComplaint[];
  labels: { title: string; description: string };
}) {
  return (
    <>
      <PageHeader
        icon={MessageSquareWarning}
        title={labels.title}
        description={labels.description}
        actions={
          <Badge variant={items.length > 0 ? "secondary" : "outline"} className="text-xs">
            {items.length} in scope
          </Badge>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title="No complaints in your scope"
          description="New complaints appear here the moment they're filed — nothing is waiting on you right now."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((c) => (
            <Card key={c.id} className="flex flex-col gap-0 overflow-hidden py-0">
              <CardHeader className="gap-1.5 border-b px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{c.subject}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[11px]">
                      {c.category}
                    </Badge>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.submittedBy.name}
                  {c.submittedBy.registrationNo ? ` · ${c.submittedBy.registrationNo}` : ""} ·{" "}
                  {c.createdAt.toLocaleString("en-GB", {
                    timeZone: "Asia/Karachi",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {c.assignedTo ? ` · assigned to ${c.assignedTo.name}` : ""}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <p className="text-sm leading-6 text-muted-foreground">{c.description}</p>

                <form action={complaintTransitionAction} className="mt-auto space-y-3 border-t pt-4">
                  <input type="hidden" name="id" value={c.id} />
                  <Input name="comment" placeholder="Note to the submitter (optional)" className="h-9" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" name="assignToMe" className="size-4 accent-primary" />
                      Assign to me
                    </label>
                    <ComplaintActions status={c.status} />
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
