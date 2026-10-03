import { BellRing, Megaphone, Send } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  } catch (error) {
    console.error("broadcast load failed:", error);
    dbError = true;
  }

  return (
    <>
      <PageHeader
        icon={Megaphone}
        title="Broadcast"
        description="Send an announcement to a whole audience — recipients see it in their notifications instantly."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BellRing className="h-4 w-4 text-muted-foreground" />
              New announcement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={sendBroadcast} className="grid gap-4">
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
                <Label htmlFor="title">
                  Title <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g. Exam schedule published"
                  required
                  minLength={3}
                  maxLength={120}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">
                  Message <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Textarea
                  id="body"
                  name="body"
                  placeholder="What should everyone know?"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="link">
                  Link <span className="text-xs font-normal text-muted-foreground">(optional, internal path)</span>
                </Label>
                <Input id="link" name="link" placeholder="/exams" />
              </div>
              <SubmitButton className="w-fit" pendingLabel="Sending…">
                <Send className="h-4 w-4" />
                Send announcement
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Recent announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {dbError ? (
              <Alert variant="destructive">
                <AlertTitle>History unavailable</AlertTitle>
                <AlertDescription>Sent announcements couldn&apos;t be loaded from the database.</AlertDescription>
              </Alert>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="Nothing sent yet"
                description="Your first announcement will show up here with its recipient count."
                compact
              />
            ) : (
              <ul className="divide-y">
                {recent.map((a) => (
                  <li key={a.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Badge variant="secondary" className="shrink-0 text-[11px] font-normal">
                        {a.recipients} recipient{a.recipients === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
