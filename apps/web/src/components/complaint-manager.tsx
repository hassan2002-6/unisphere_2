import Link from "next/link";
import { ExternalLink, MessageSquareWarning } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ComplaintActions } from "@/components/complaint-actions";
import { complaintActionAction } from "@/app/(portal)/complaints/actions";

type ManagedComplaint = {
  id: string;
  refNo: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  overdue?: boolean;
  createdAt: Date;
  submittedBy: { name: string; registrationNo: string | null };
  assignedTo: { name: string } | null;
};

const PRIORITY_TONE: Record<string, string> = {
  HIGH: "border-transparent bg-[#f8d7da] text-[#721c24] dark:bg-[#721c24]/35 dark:text-[#f4aeb6]",
  MEDIUM: "border-transparent bg-[#fff3cd] text-[#856404] dark:bg-[#856404]/30 dark:text-[#f2d78d]",
  LOW: "border-transparent bg-[#f5f5f5] text-[#555555] dark:bg-muted dark:text-muted-foreground",
};

/** Shared management list for /coordinator/complaints and /faculty/complaints. */
export function ComplaintManager({
  items,
  labels,
  toolbar,
}: {
  items: ManagedComplaint[];
  labels: { title: string; description: string };
  /** Optional slot rendered between the header and the list (e.g. filters). */
  toolbar?: React.ReactNode;
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

      {toolbar}

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
                  <CardTitle className="text-sm font-semibold">
                    <Link href={`/complaints/${c.id}`} className="hover:underline">
                      {c.subject}
                    </Link>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.overdue ? <StatusBadge status="OVERDUE" /> : null}
                    <Badge variant="outline" className={PRIORITY_TONE[c.priority] ?? ""}>
                      {c.priority.toLowerCase()}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {c.category}
                    </Badge>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.refNo} · {c.submittedBy.name}
                  {c.submittedBy.registrationNo ? ` · ${c.submittedBy.registrationNo}` : ""} ·{" "}
                  {c.createdAt.toLocaleString("en-GB", {
                    timeZone: "Asia/Karachi",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {c.assignedTo ? ` · assigned to ${c.assignedTo.name}` : " · unassigned"}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{c.description}</p>

                <form action={complaintActionAction} className="mt-auto space-y-3 border-t pt-4">
                  <input type="hidden" name="id" value={c.id} />
                  <Input name="comment" placeholder="Comment — public, shown to the student" className="h-9" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/complaints/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open full case
                    </Link>
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
