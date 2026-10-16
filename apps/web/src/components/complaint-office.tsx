import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import type { User } from "@unisphere/db";
import { cn } from "cn";
import { countUnreadComplaints, listInboxComplaints, listManagedComplaints } from "@/server/services/complaints";
import { mapInboxView } from "@/lib/complaint-policy";
import { ComplaintInbox } from "@/components/complaint-inbox";
import { ComplaintManager } from "@/components/complaint-manager";
import { ComplaintFilters } from "@/components/complaint-filters";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

/**
 * Complaints page for staff offices (coordinator / faculty). Tabs between the
 * personal Inbox — recipient-scoped, with unread badges (goal §8) — and the
 * existing managed-desk view.
 */

export type ComplaintOfficeFilters = {
  tab?: string;
  view?: string;
  status?: string;
  priority?: string;
  overdue?: string;
  q?: string;
};

export async function ComplaintOffice({
  user,
  basePath,
  labels,
  filters,
}: {
  user: User;
  /** Route the tabs/filters live under, e.g. /coordinator/complaints. */
  basePath: string;
  labels: { title: string; description: string };
  filters: ComplaintOfficeFilters;
}) {
  const tab = filters.tab === "desk" ? "desk" : "inbox";
  const view = mapInboxView(filters.view).view;

  let inbox: Awaited<ReturnType<typeof listInboxComplaints>> | null = null;
  let desk: Awaited<ReturnType<typeof listManagedComplaints>> | null = null;
  let unreadCount = 0;
  try {
    if (tab === "inbox") {
      inbox = await listInboxComplaints(user, { view });
      unreadCount = inbox.unreadCount;
    } else {
      desk = await listManagedComplaints(user, {
        status: filters.status,
        priority: filters.priority,
        overdueOnly: filters.overdue === "1",
        q: filters.q,
      });
      unreadCount = await countUnreadComplaints(user);
    }
  } catch {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title={labels.title} />
        <Alert variant="destructive">
          <AlertTitle>Complaints unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
      active ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <>
      <PageHeader
        icon={MessageSquareWarning}
        title={labels.title}
        description={labels.description}
        actions={
          <Badge variant={unreadCount > 0 ? "default" : "outline"} className="text-xs">
            {unreadCount > 0 ? `${unreadCount} unread` : "Inbox zero"}
          </Badge>
        }
      />

      <nav aria-label="Complaint sections" className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-card p-1">
        <Link href={`${basePath}?tab=inbox`} aria-current={tab === "inbox" ? "page" : undefined} className={tabClass(tab === "inbox")}>
          Inbox
          {unreadCount > 0 ? (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
              {unreadCount}
            </Badge>
          ) : null}
        </Link>
        <Link href={`${basePath}?tab=desk`} aria-current={tab === "desk" ? "page" : undefined} className={tabClass(tab === "desk")}>
          Complaints desk
        </Link>
      </nav>

      {tab === "inbox" && inbox ? (
        <ComplaintInbox items={inbox.items} view={inbox.view} unreadCount={inbox.unreadCount} basePath={basePath} />
      ) : desk ? (
        <ComplaintManager
          showHeader={false}
          items={desk.items}
          labels={labels}
          toolbar={
            <ComplaintFilters
              status={filters.status ?? ""}
              priority={filters.priority ?? ""}
              overdue={filters.overdue === "1"}
              q={filters.q ?? ""}
              hiddenFields={{ tab: "desk" }}
            />
          }
        />
      ) : null}
    </>
  );
}
