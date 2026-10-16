import Link from "next/link";
import { ExternalLink, Inbox } from "lucide-react";
import { cn } from "cn";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

/**
 * Recipient-scoped inbox (goal §8) for the complaint pages: complaints where
 * the signed-in user holds a To or CC recipient row are listed here, with the
 * unread badges that tie into the auto-mark-read flow on the detail page.
 */

type InboxComplaint = {
  id: string;
  refNo: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  overdue?: boolean;
  createdAt: Date;
  unread?: boolean;
  recipientRole: string | null;
  submittedBy: { name: string; registrationNo: string | null };
  assignedTo: { name: string } | null;
};

const VIEW_TABS = [
  { key: "inbox", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
  { key: "archived", label: "Archived" },
] as const;

const PRIORITY_TONE: Record<string, string> = {
  HIGH: "border-transparent bg-[#f8d7da] text-[#721c24] dark:bg-[#721c24]/35 dark:text-[#f4aeb6]",
  MEDIUM: "border-transparent bg-[#fff3cd] text-[#856404] dark:bg-[#856404]/30 dark:text-[#f2d78d]",
  LOW: "border-transparent bg-[#f5f5f5] text-[#555555] dark:bg-muted dark:text-muted-foreground",
};

export function ComplaintInbox({
  items,
  view,
  unreadCount,
  basePath,
}: {
  items: InboxComplaint[];
  /** Active inbox view — inbox | unread | pending | resolved | archived. */
  view: string;
  unreadCount: number;
  /** Page path for view links (tab/view query params are appended). */
  basePath: string;
}) {
  return (
    <>
      <nav aria-label="Inbox views" className="flex flex-wrap items-center gap-1">
        {VIEW_TABS.map((t) => {
          const active = t.key === view;
          return (
            <Link
              key={t.key}
              href={`${basePath}?tab=inbox&view=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm transition-colors",
                active
                  ? "border-border bg-secondary font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
              {t.key === "unread" && unreadCount > 0 ? (
                <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                  {unreadCount}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing in this view"
          description="Complaints where you are a To or CC recipient land here — nothing is waiting on you right now."
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
                    {c.unread ? <Badge className="text-[10px]">New</Badge> : null}
                    <Badge variant={c.recipientRole === "CC" ? "outline" : "secondary"} className="text-[11px]">
                      {c.recipientRole === "CC" ? "CC — read-only" : "To you"}
                    </Badge>
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
                <div className="mt-auto border-t pt-4">
                  <Link
                    href={`/complaints/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open complaint
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
