import Link from "next/link";
import { Fragment } from "react";
import { ChevronDown, ChevronUp, Inbox, Mail, MailPlus, PenSquare, Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  getRecipients,
  getUnreadMessageCount,
  listInbox,
  listSent,
} from "@/server/services/messages";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { markReadAction, sendMessageAction } from "./actions";

export const dynamic = "force-dynamic";

type View = "inbox" | "sent" | "compose";

function snippet(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 96 ? `${flat.slice(0, 96)}…` : flat;
}

function formatTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; open?: string; error?: string; sent?: string }>;
}) {
  const user = await requireUser();
  const { view, open, error, sent } = await searchParams;

  const activeView: View = view === "sent" ? "sent" : view === "compose" ? "compose" : "inbox";

  let unreadCount = 0;
  let inbox: Awaited<ReturnType<typeof listInbox>> = [];
  let sentMessages: Awaited<ReturnType<typeof listSent>> = [];
  let recipients: Awaited<ReturnType<typeof getRecipients>> = [];
  let dbError = false;

  try {
    unreadCount = await getUnreadMessageCount(user);
    if (activeView === "inbox") inbox = await listInbox(user, { take: 40 });
    else if (activeView === "sent") sentMessages = await listSent(user, { take: 40 });
    else recipients = await getRecipients(user);
  } catch (loadError) {
    console.error("messages load failed:", loadError);
    dbError = true;
  }

  return (
    <>
      <PageHeader
        icon={Mail}
        title="Messages"
        description="Private messages between you and others in the portal — recipients are limited to your courses and role."
        actions={
          <Button asChild variant={activeView === "compose" ? "secondary" : "default"}>
            <Link href="/messages?view=compose">
              <PenSquare className="h-4 w-4" />
              Compose
            </Link>
          </Button>
        }
      />

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Messages unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : (
        <>
          <nav aria-label="Message views" className="flex flex-wrap items-center gap-2">
            <Button asChild variant={activeView === "inbox" ? "default" : "outline"} size="sm">
              <Link href="/messages?view=inbox">
                <Inbox className="h-4 w-4" />
                Inbox
                {unreadCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {unreadCount}
                  </Badge>
                ) : null}
              </Link>
            </Button>
            <Button asChild variant={activeView === "sent" ? "default" : "outline"} size="sm">
              <Link href="/messages?view=sent">
                <Send className="h-4 w-4" />
                Sent
              </Link>
            </Button>
            <Button asChild variant={activeView === "compose" ? "default" : "outline"} size="sm">
              <Link href="/messages?view=compose">
                <PenSquare className="h-4 w-4" />
                Compose
              </Link>
            </Button>
          </nav>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Message not sent</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {sent ? (
            <Alert variant="success">
              <AlertTitle>Message sent</AlertTitle>
              <AlertDescription>
                It&apos;s in the recipient&apos;s inbox now — track it any time under Sent.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="max-w-sm">
            <StatCard
              label="Unread messages"
              value={unreadCount}
              hint={unreadCount > 0 ? "Open one and mark it read" : "You're all caught up"}
              icon={Inbox}
              tone={unreadCount > 0 ? "primary" : "success"}
            />
          </div>

          {activeView === "inbox" ? (
            inbox.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Inbox empty"
                description="Messages from faculty, coordinators, mentors and other portal users land here."
                action={
                  <Button asChild>
                    <Link href="/messages?view=compose">
                      <PenSquare className="h-4 w-4" />
                      Compose a message
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card className="gap-0 overflow-hidden py-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="pl-5">From</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead className="pr-5 text-right">
                          <span className="sr-only">Open</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inbox.map((m) => {
                        const isOpen = open === m.id;
                        const unread = !m.readAt;
                        return (
                          <Fragment key={m.id}>
                            <TableRow className={isOpen ? "bg-muted/40 hover:bg-muted/40" : undefined}>
                              <TableCell className="pl-5">
                                <div className="flex items-center gap-2.5">
                                  {unread ? (
                                    <span
                                      aria-label="Unread"
                                      className="h-2 w-2 shrink-0 rounded-full bg-primary"
                                    />
                                  ) : (
                                    <span aria-hidden className="h-2 w-2 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-medium">{m.sender.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {ROLE_LABELS[m.sender.role]}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-md whitespace-normal">
                                <Link
                                  href={isOpen ? "/messages?view=inbox" : `/messages?view=inbox&open=${m.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {m.subject ?? "(No subject)"}
                                </Link>
                                {!isOpen ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{snippet(m.body)}</p>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground tabular-nums">
                                {formatTime(m.createdAt)}
                              </TableCell>
                              <TableCell className="pr-5 text-right">
                                <Button asChild variant="ghost" size="sm">
                                  <Link
                                    href={isOpen ? "/messages?view=inbox" : `/messages?view=inbox&open=${m.id}`}
                                  >
                                    {isOpen ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                    {isOpen ? "Close" : "Open"}
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isOpen ? (
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={4} className="whitespace-normal">
                                  <div className="space-y-3 border-l-4 border-l-primary py-1 pl-4">
                                    <p className="max-w-3xl text-sm leading-6 whitespace-pre-wrap">{m.body}</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {unread ? (
                                        <form action={markReadAction}>
                                          <input type="hidden" name="id" value={m.id} />
                                          <SubmitButton size="sm" variant="secondary" pendingLabel="Marking…">
                                            Mark as read
                                          </SubmitButton>
                                        </form>
                                      ) : (
                                        <Badge variant="outline">Read</Badge>
                                      )}
                                      <Button asChild variant="ghost" size="sm">
                                        <Link href="/messages?view=inbox">Close</Link>
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          ) : null}

          {activeView === "sent" ? (
            sentMessages.length === 0 ? (
              <EmptyState
                icon={Send}
                title="Nothing sent yet"
                description="Messages you send appear here with the recipient and a preview."
                action={
                  <Button asChild>
                    <Link href="/messages?view=compose">
                      <PenSquare className="h-4 w-4" />
                      Compose a message
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card className="gap-0 overflow-hidden py-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="pl-5">To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="pr-5">Sent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentMessages.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="pl-5">
                            <p className="font-medium">{m.recipient.name}</p>
                            <p className="text-xs text-muted-foreground">{ROLE_LABELS[m.recipient.role]}</p>
                          </TableCell>
                          <TableCell className="max-w-md whitespace-normal">
                            <p className="font-medium">{m.subject ?? "(No subject)"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{snippet(m.body)}</p>
                          </TableCell>
                          <TableCell className="pr-5 text-xs text-muted-foreground tabular-nums">
                            {formatTime(m.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          ) : null}

          {activeView === "compose" ? (
            recipients.length === 0 ? (
              <EmptyState
                icon={MailPlus}
                title="No contacts to message yet"
                description="Your recipient list is derived from your role, courses and mentees — once that setup exists, contacts will appear here."
              />
            ) : (
              <Card className="max-w-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-semibold">New message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={sendMessageAction} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="recipientId">
                        Recipient <span className="text-destructive" aria-hidden>*</span>
                      </Label>
                      <Select name="recipientId">
                        <SelectTrigger id="recipientId" className="w-full">
                          <SelectValue placeholder="Pick a recipient" />
                        </SelectTrigger>
                        <SelectContent>
                          {recipients.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="subject">
                        Subject{" "}
                        <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input id="subject" name="subject" placeholder="What is this about?" maxLength={120} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="body">
                        Message <span className="text-destructive" aria-hidden>*</span>
                      </Label>
                      <Textarea
                        id="body"
                        name="body"
                        placeholder="Write your message…"
                        required
                        minLength={2}
                        maxLength={4000}
                        rows={6}
                      />
                    </div>
                    <SubmitButton className="w-fit" pendingLabel="Sending…">
                      <Send className="h-4 w-4" />
                      Send message
                    </SubmitButton>
                  </form>
                </CardContent>
              </Card>
            )
          ) : null}
        </>
      )}
    </>
  );
}
