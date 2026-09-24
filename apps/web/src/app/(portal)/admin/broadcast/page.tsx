import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendBroadcast } from "./actions";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  await requireCapability("broadcast");

  let recent: { id: string; title: string; body: string; createdAt: Date; recipients: number }[] = [];
  let dbError = false;
  try {
    const announcements = await prisma.notification.findMany({
      where: { type: "ANNOUNCEMENT" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, body: true, createdAt: true },
    });
    recent = announcements.map((a) => ({ ...a, recipients: 0 }));
    // Count recipients cheaply: notifications created within the same second by the batch.
    for (const r of recent) {
      const from = new Date(r.createdAt.getTime() - 1000);
      const to = new Date(r.createdAt.getTime() + 1000);
      const rows = await prisma.notification.count({
        where: { type: "ANNOUNCEMENT", createdAt: { gte: from, lte: to } },
      });
      r.recipients = rows;
    }
  } catch {
    dbError = true;
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Broadcast</h1>
        <p className="text-sm text-muted-foreground">
          Send an announcement to a whole audience. Recipients see it in their notifications.
        </p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={sendBroadcast} className="grid max-w-xl gap-4">
            <div className="grid gap-2">
              <Label htmlFor="audience">Audience</Label>
              <Select name="audience" defaultValue="STUDENT">
                <SelectTrigger id="audience" className="w-full">
                  <SelectValue placeholder="Pick an audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">All students</SelectItem>
                  <SelectItem value="FACULTY">All faculty</SelectItem>
                  <SelectItem value="MENTOR">All mentors</SelectItem>
                  <SelectItem value="COORDINATOR">Coordinators</SelectItem>
                  <SelectItem value="FYP_HEAD">FYP Heads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="e.g. Exam schedule published" required minLength={3} maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" name="body" placeholder="What should everyone know?" required minLength={5} maxLength={1000} rows={4} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="link">Link (optional, internal path)</Label>
              <Input id="link" name="link" placeholder="/exams" />
            </div>
            <Button type="submit" className="w-fit">
              Send announcement
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Recent announcements</CardTitle>
          {dbError ? <CardDescription>Database did not answer.</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && !dbError ? (
            <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
          ) : (
            recent.map((a) => (
              <div key={a.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} · {a.recipients} recipient
                  {a.recipients === 1 ? "" : "s"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
