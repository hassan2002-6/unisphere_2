import { requireUser } from "@/lib/auth";
import { listApprovedMentors, listMyMentorshipRequests } from "@/server/services/mentorship";
import { StatusBadge } from "@/components/status-badge";
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
    <main className="space-y-4 p-6">
      {sent ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Request sent — your mentor will respond soon.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mentorship</h1>
        <p className="text-sm text-muted-foreground">
          Alumni and faculty mentors — request guidance, schedule sessions, get unstuck.
        </p>
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mentorship data unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {requests.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">My mentorships ({requests.length})</CardTitle>
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
                      <form action={cancelMentorshipAction}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Cancel
                        </Button>
                      </form>
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
                            <form action={respondToSessionAction} className="flex gap-1">
                              <input type="hidden" name="sessionId" value={s.id} />
                              <Button type="submit" name="decision" value="CONFIRMED" size="sm" variant="secondary">
                                Confirm
                              </Button>
                              <Button type="submit" name="decision" value="CANCELLED" size="sm" variant="outline">
                                Decline
                              </Button>
                            </form>
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
                    <Button type="submit" size="sm">
                      Propose session
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Mentor directory ({mentors.length})</CardTitle>
          <CardDescription>Approved mentors only — requests are reviewed by the FYP Head first.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {mentors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mentors approved yet.</p>
          ) : (
            mentors.map((m) => (
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
                    <Button type="submit" size="sm" className="w-fit">
                      Request mentorship
                    </Button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
