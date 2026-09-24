import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/server/services/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
};

export default async function NotificationsPage() {
  const user = await requireUser();

  let data: Awaited<ReturnType<typeof listNotifications>> | null = null;
  try {
    data = await listNotifications(user.id, { take: 30 });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const unread = data.items.filter((n) => !n.readAt).length;

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up."}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      {data.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing here yet</CardTitle>
            <CardDescription>
              Notifications appear when your forms, complaints, requests or sessions change state.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => (
            <Card key={n.id} className={n.readAt ? "opacity-70" : "border-l-4 border-l-primary"}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{TYPE_LABELS[n.type] ?? n.type}</Badge>
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.readAt ? <span className="h-2 w-2 rounded-full bg-primary" aria-label="unread" /> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
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
                      <Button type="submit" variant="secondary" size="sm">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
