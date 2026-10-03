import { HeartHandshake, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listApprovedMentors, listMyMentorshipRequests } from "@/server/services/mentorship";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cancelMentorshipAction, proposeSessionAction, requestMentorshipAction, respondToSessionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MentorshipPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { sent, error } = await searchParams;

  let mentors: Awaited<ReturnType<typeof listApprovedMentors>> = [];
  let requests: Awaited<ReturnType<typeof listMyMentorshipRequests>> = [];
  let dbError = false;
  try {
    [mentors, requests] = await Promise.all([listApprovedMentors(), listMyMentorshipRequests(user)]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        icon={HeartHandshake}
        title="Mentorship"
        description="Alumni and faculty mentors — request guidance, schedule sessions, get unstuck."
      />

      {sent ? (
        <Alert variant="success">
          <AlertTitle>Request sent</AlertTitle>
          <AlertDescription>Your mentor will respond soon.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Mentorship data unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check DATABASE_URL and the Neon project.</AlertDescription>
        </Alert>
      ) : null}

      {!dbError && (mentors.length > 0 || requests.length > 0) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="My mentorships"
            value={requests.length}
            hint="Requests you've sent"
            icon={HeartHandshake}
            tone="primary"
          />
          <StatCard
            label="Approved mentors"
            value={mentors.length}
            hint="Available to guide you"
            icon={Users}
            tone="info"
          />
        </section>
      ) : null}

      {!dbError && requests.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <HeartHandshake className="h-4 w-4 text-muted-foreground" />
              My mentorships ({requests.length})
            </CardTitle>
            <CardDescription>Sessions you propose need your mentor&apos;s confirmation (and vice-versa).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.map((r) => (
              <div key={r.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{r.mentor.name}</span>{" "}
                    <span className="text-muted-foreground">· {r.mentor.email}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.status === "PENDING" ? (
                      <ConfirmAction
                        action={cancelMentorshipAction}
                        values={{ requestId: r.id }}
                        title="Cancel this mentorship request?"
                        description="The mentor will no longer see it — you can send a fresh request any time."
                        confirmLabel="Cancel request"
                        variant="destructive"
                        trigger={
                          <Button variant="ghost" size="sm">
                            Cancel
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{r.message}</p>

                {r.sessions.length > 0 ? (
                  <div className="space-y-2">
                    {r.sessions.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                        <div className="text-sm">
                          <span className="font-medium">
                            {s.scheduledAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            · {s.mode}
                            {s.location ? ` · ${s.location}` : ""}
                            {s.proposedById === user.id ? " · proposed by you" : " · proposed by mentor"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={s.status} />
                          {s.status === "PROPOSED" && s.proposedById !== user.id ? (
                            <>
                              <ConfirmAction
                                action={respondToSessionAction}
                                values={{ sessionId: s.id, decision: "CONFIRMED" }}
                                title="Confirm this session?"
                                description="The session is locked in for the proposed time."
                                confirmLabel="Confirm"
                                trigger={
                                  <Button size="sm" variant="secondary">
                                    Confirm
                                  </Button>
                                }
                              />
                              <ConfirmAction
                                action={respondToSessionAction}
                                values={{ sessionId: s.id, decision: "CANCELLED" }}
                                title="Decline this session?"
                                description="The other side will see the session as declined."
                                confirmLabel="Decline"
                                variant="destructive"
                                trigger={
                                  <Button size="sm" variant="outline">
                                    Decline
                                  </Button>
                                }
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {r.status === "ACCEPTED" ? (
                  <form action={proposeSessionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="back" value="/mentorship" />
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground">When</label>
                      <input
                        type="datetime-local"
                        name="scheduledAt"
                        required
                        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground">Mode</label>
                      <input
                        name="mode"
                        required
                        placeholder="Online / On-campus"
                        className="border-input h-9 w-40 rounded-md border bg-transparent px-3 text-sm"
                      />
                    </div>
                    <SubmitButton size="sm" pendingLabel="Proposing…">
                      Propose session
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!dbError ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Mentor directory ({mentors.length})
            </CardTitle>
            <CardDescription>Approved mentors only — requests are reviewed by the FYP Head first.</CardDescription>
          </CardHeader>
          <CardContent>
            {mentors.length === 0 ? (
              <EmptyState
                compact
                icon={Users}
                title="No mentors approved yet"
                description="Approved mentors appear in this directory — check back soon."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {mentors.map((m) => (
                  <div key={m.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-medium">{m.user.name}</span>{" "}
                        <span className="text-muted-foreground">· {m.headline}</span>
                      </p>
                      <Badge variant="outline">{m.maxActiveMentees} mentees max</Badge>
                    </div>
                    {m.company ? <p className="text-xs text-muted-foreground">{m.company}</p> : null}
                    {m.bio ? <p className="text-sm text-muted-foreground">{m.bio}</p> : null}
                    <div className="flex flex-wrap gap-1">
                      {m.expertise.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    {user.role === "STUDENT" ? (
                      <form action={requestMentorshipAction} className="grid gap-2">
                        <input type="hidden" name="mentorUserId" value={m.user.id} />
                        <Textarea
                          name="message"
                          rows={2}
                          required
                          minLength={10}
                          maxLength={2000}
                          placeholder="What do you want help with?"
                        />
                        <SubmitButton size="sm" className="w-fit" pendingLabel="Sending…">
                          Request mentorship
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
