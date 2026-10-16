import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/server/services/notifications";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  FORM: "Forms",
  COMPLAINT: "Complaints",
  FYP: "FYP",
  RESOURCE: "Resources",
  MENTORSHIP: "Mentorship",
  INTERNSHIP: "Internships",
  ANNOUNCEMENT: "Announcements",
  SYSTEM: "System",
  MESSAGE: "Messages",
  CLASH: "Clashes",
  ASSIGNMENT: "Assignments",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const { type: rawType } = await searchParams;
  // Whitelist against the real enum so junk values cannot reach the query.
  const type = rawType && rawType in TYPE_LABELS ? rawType : undefined;

  let data: Awaited<ReturnType<typeof listNotifications>> | null = null;
  try {
    data = await listNotifications(user.id, { take: 30, type: type as never });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <>
        <PageHeader icon={Bell} title="Notifications" />
        <Alert variant="destructive">
          <AlertTitle>Notifications unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check DATABASE_URL and the Neon project.</AlertDescription>
        </Alert>
      </>
    );
  }

  const unread = data.items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        icon={Bell}
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Marking…">
                Mark all as read
              </SubmitButton>
            </form>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Button asChild size="sm" variant={type ? "ghost" : "secondary"} className="h-7 px-2.5 text-xs">
          <Link href="/notifications">All</Link>
        </Button>
        {Object.keys(TYPE_LABELS).map((t) => (
          <Button
            key={t}
            asChild
            size="sm"
            variant={type === t ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs"
          >
            <Link href={`/notifications?type=${t}`}>{TYPE_LABELS[t]}</Link>
          </Button>
        ))}
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nothing here yet"
          description={
            type
              ? `No "${TYPE_LABELS[type]}" notifications — try another category or All.`
              : "Notifications appear when your forms, complaints, requests or sessions change state."
          }
        />
      ) : (
        <ul className="space-y-2">
          {data.items.map((n) => (
            <li key={n.id}>
              <div className={n.readAt ? "notif-item opacity-75" : "notif-item"}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{TYPE_LABELS[n.type] ?? n.type}</Badge>
                      <span className="text-sm font-semibold">{n.title}</span>
                      {!n.readAt ? <span className="h-2 w-2 rounded-full bg-primary" aria-label="unread" /> : null}
                    </div>
                    <p className="mt-1 text-[13px]">{n.body}</p>
                    <small className="mt-1 block text-[11px] text-muted-foreground">
                      {n.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {n.link ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={n.link}>Open</Link>
                      </Button>
                    ) : null}
                    {!n.readAt ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton variant="secondary" size="sm" pendingLabel="Working…">
                          Mark read
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
