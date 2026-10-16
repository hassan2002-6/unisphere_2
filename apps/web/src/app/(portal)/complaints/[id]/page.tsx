import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, FileText, History, MessageSquareWarning, ShieldAlert, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getComplaint, listComplaintHandlers, markComplaintRead } from "@/server/services/complaints";
import { StatusBadge } from "@/components/status-badge";
import { ComplaintActions } from "@/components/complaint-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { complaintActionAction, complaintNoteAction, complaintReplyAction } from "../actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  STATUS: "Status",
  RESPONSE: "Response",
  FORWARD: "Forwarded",
  NOTE: "Internal note",
  ESCALATION: "Escalated",
};

export default async function ComplaintDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { created, ok, error } = await searchParams;

  const loaded = await getComplaint(user, id).catch(() => null);
  if (!loaded) notFound();

  // Recipients (To or CC) see the complaint → auto-mark their inbox row read.
  let complaint = loaded;
  if (complaint.myRecipient && !complaint.myRecipient.readAt) {
    await markComplaintRead(user, complaint.id);
    complaint = { ...complaint, myRecipient: { ...complaint.myRecipient, readAt: new Date() } };
  }

  const handlers = complaint.canAct ? await listComplaintHandlers() : [];
  const toRecipients = complaint.recipients.filter((r) => r.role === "TO");
  const ccRecipients = complaint.recipients.filter((r) => r.role === "CC");
  const isCaseStaff = complaint.isManager || complaint.isRecipient;
  const queueHref =
    user.role === "FACULTY" ? "/faculty/complaints" : user.role === "COORDINATOR" || user.role === "ADMIN" ? "/coordinator/complaints" : "/complaints";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: isCaseStaff ? "Complaint queue" : "Complaint Box", href: isCaseStaff ? queueHref : "/complaints" },
          { label: complaint.refNo },
        ]}
        icon={MessageSquareWarning}
        title={complaint.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {complaint.refNo}
            </Badge>
            <Badge variant="secondary">{complaint.category}</Badge>
            <Badge variant="outline">priority: {complaint.priority.toLowerCase()}</Badge>
            <StatusBadge status={complaint.status} />
            {complaint.overdue ? <StatusBadge status="OVERDUE" /> : null}
            {complaint.assignedTo ? <span>handled by {complaint.assignedTo.name}</span> : <span>not yet assigned</span>}
            {toRecipients.length > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium">To:</span>
                {toRecipients.map((r) => (
                  <Badge key={r.id} variant="secondary" className="text-[11px]">
                    {r.user.name}
                  </Badge>
                ))}
              </span>
            ) : null}
            {ccRecipients.length > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium">CC:</span>
                {ccRecipients.map((r) => (
                  <Badge key={r.id} variant="outline" className="text-[11px]">
                    {r.user.name}
                  </Badge>
                ))}
              </span>
            ) : null}
            {complaint.myRecipient?.role === "TO" ? <Badge variant="secondary">you are a To recipient</Badge> : null}
            {complaint.myRecipient?.role === "CC" ? <Badge variant="outline">you are CC’d — read-only</Badge> : null}
          </span>
        }
      />

      {created ? (
        <Alert variant="success">
          <AlertTitle>Complaint filed</AlertTitle>
          <AlertDescription>
            Your reference number is <span className="font-mono font-semibold">{complaint.refNo}</span>. You&apos;ll be
            notified as it progresses.
          </AlertDescription>
        </Alert>
      ) : null}
      {ok ? (
        <Alert variant="success">
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>The complaint history has been updated.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action not applied</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Description
            </CardTitle>
            <CardDescription>
              Filed by {complaint.submittedBy.name}
              {complaint.class ? ` · ${complaint.class.courseCode} ${complaint.class.title} (${complaint.class.section})` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{complaint.description}</p>
            {complaint.attachmentName ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/api/complaints/${complaint.id}/attachment`}>
                  <Download className="h-3.5 w-3.5" />
                  {complaint.attachmentName}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {complaint.canAct ? (
          <Card>
            <CardHeader className="py-3.5">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Office actions
              </CardTitle>
              <CardDescription>
                {complaint.myRecipient?.role === "TO" ? "You are a To recipient — actions here update the case. " : ""}
                Public comments are shown to the student; internal notes are not.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={complaintActionAction} className="space-y-3">
                <input type="hidden" name="id" value={complaint.id} />
                <Textarea name="comment" rows={3} maxLength={2000} placeholder="Comment (required for responses and requests)" />
                <ComplaintActions status={complaint.status} />
                <div className="grid gap-1.5 border-t pt-3">
                  <Label htmlFor="toUserId" className="text-xs">
                    Forward to another office
                  </Label>
                  <select
                    id="toUserId"
                    name="toUserId"
                    defaultValue=""
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="">Choose a person…</option>
                    {handlers.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {h.role.replaceAll("_", " ").toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="submit" name="action" value="forward" variant="outline" size="sm">
                      <Undo2 className="h-3.5 w-3.5" />
                      Forward
                    </Button>
                    <Button type="submit" name="action" value="escalate" variant="outline" size="sm">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Escalate
                    </Button>
                  </div>
                </div>
              </form>

              <form action={complaintNoteAction} className="space-y-2 border-t pt-3">
                <input type="hidden" name="id" value={complaint.id} />
                <Label htmlFor="note" className="text-xs">
                  Internal note (never shown to the student)
                </Label>
                <Input id="note" name="note" maxLength={2000} placeholder="Visible to staff only" />
                <SubmitButton variant="outline" size="sm" pendingLabel="Saving…" className="w-fit">
                  Add internal note
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : complaint.myRecipient ? (
          <Card>
            <CardHeader className="py-3.5">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                CC — read-only
              </CardTitle>
              <CardDescription>
                You were CC’d on this complaint for visibility. You can follow the whole case here, but only the To
                recipients, the assignee and the office can act on it.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="py-3.5">
              <CardTitle className="text-sm font-semibold">Add a reply</CardTitle>
              <CardDescription>
                {complaint.status === "AWAITING_INFO"
                  ? "The office asked for more information — reply below."
                  : "You can add extra detail at any time."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={complaintReplyAction} className="space-y-3">
                <input type="hidden" name="id" value={complaint.id} />
                <Textarea name="comment" rows={4} required minLength={2} maxLength={2000} placeholder="Your reply…" />
                <SubmitButton size="sm" pendingLabel="Sending…" className="w-fit">
                  Send reply
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            History
          </CardTitle>
          <CardDescription>
            Full trail with who did what and when{complaint.isManager || complaint.isRecipient ? " — including internal notes" : ""}.
          </CardDescription>
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
                    <Badge variant={e.visibility === "INTERNAL" ? "destructive" : "secondary"} className="text-[11px]">
                      {KIND_LABEL[e.kind] ?? e.kind}
                      {e.visibility === "INTERNAL" ? " · staff only" : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {e.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{e.actor?.name ?? "System"}</span>
                    {e.assigneeFrom || e.assigneeTo ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({e.assigneeFrom?.name ?? "unassigned"} → {e.assigneeTo?.name ?? "unassigned"})
                      </span>
                    ) : null}
                    {e.comment ? <span className="text-muted-foreground"> — {e.comment}</span> : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Filed{" "}
            {complaint.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {complaint.dueAt ? ` · response expected by ${complaint.dueAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short" })}` : ""}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
