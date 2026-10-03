import { Clock, GraduationCap, Inbox, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMentorProfileByUserId, listMentorRequests } from "@/server/services/mentorship";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  completeSessionAction,
  proposeSessionAction,
  respondToMentorshipAction,
  respondToSessionAction,
  upsertMentorProfileAction,
} from "../mentorship/actions";

export const dynamic = "force-dynamic";

export default async function MentorConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { saved, error } = await searchParams;

  let profile: Awaited<ReturnType<typeof getMentorProfileByUserId>> = null;
  let requests: Awaited<ReturnType<typeof listMentorRequests>> = [];
  let dbError = false;
  try {
    [profile, requests] = await Promise.all([getMentorProfileByUserId(user.id), listMentorRequests(user)]);
  } catch {
    dbError = true;
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const active = requests.filter((r) => r.status === "ACCEPTED");

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="Mentor Console"
        description={
          dbError
            ? "Database unavailable — check DATABASE_URL."
            : profile
              ? `Your directory listing is ${profile.isApproved ? "live" : "awaiting approval"}.`
              : "Set up your mentor profile to appear in the directory."
        }
        actions={profile ? <StatusBadge status={profile.isApproved ? "APPROVED" : "PENDING"} /> : null}
      />

      {saved ? (
        <Alert variant="success">
          <AlertTitle>Profile saved</AlertTitle>
          <AlertDescription>Approvals are handled by the FYP Head.</AlertDescription>
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
          <AlertTitle>Mentor data unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check DATABASE_URL and the Neon project.</AlertDescription>
        </Alert>
      ) : null}

      {!dbError && (pending.length > 0 || active.length > 0) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Pending requests"
            value={pending.length}
            hint={pending.length > 0 ? "Awaiting your decision" : "Nothing waiting"}
            icon={Clock}
            tone={pending.length > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Active mentees"
            value={active.length}
            hint="Accepted mentorships"
            icon={Users}
            tone={active.length > 0 ? "success" : "default"}
          />
        </section>
      ) : null}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            Mentor profile
          </CardTitle>
          <CardDescription>Headline, expertise and a short bio are what students see.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={upsertMentorProfileAction} className="grid max-w-2xl gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="headline">
                  Headline <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="headline"
                  name="headline"
                  required
                  defaultValue={profile?.headline ?? ""}
                  placeholder="Senior Software Engineer @ Systems Ltd"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" defaultValue={profile?.company ?? ""} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expertise">Expertise (comma-separated)</Label>
              <Input
                id="expertise"
                name="expertise"
                defaultValue={profile?.expertise.join(", ") ?? ""}
                placeholder="React, System Design, Career Advice"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" name="bio" rows={3} defaultValue={profile?.bio ?? ""} maxLength={2000} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="linkedinUrl">LinkedIn</Label>
              <Input id="linkedinUrl" name="linkedinUrl" defaultValue={profile?.linkedinUrl ?? ""} placeholder="https://linkedin.com/in/…" />
            </div>
            <SubmitButton className="w-fit" pendingLabel="Saving…">
              {profile ? "Save profile" : "Create profile"}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pending requests ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{r.student.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {r.student.registrationNo ? `· ${r.student.registrationNo}` : ""} · {r.student.email}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.message}</p>
                </div>
                <div className="flex gap-2">
                  <ConfirmAction
                    action={respondToMentorshipAction}
                    values={{ requestId: r.id, decision: "ACCEPTED" }}
                    title="Accept this mentorship request?"
                    description="The student will be notified and you'll appear as their mentor."
                    confirmLabel="Accept"
                    trigger={
                      <Button size="sm">
                        Accept
                      </Button>
                    }
                  />
                  <ConfirmAction
                    action={respondToMentorshipAction}
                    values={{ requestId: r.id, decision: "DECLINED" }}
                    title="Decline this request?"
                    description="The student will be notified that you declined."
                    confirmLabel="Decline"
                    variant="destructive"
                    trigger={
                      <Button variant="outline" size="sm">
                        Decline
                      </Button>
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Active mentees ({active.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {active.map((r) => (
              <div key={r.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{r.student.name}</span>{" "}
                    <span className="text-muted-foreground">· {r.student.email}</span>
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                {r.sessions.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">
                        {s.scheduledAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        · {s.mode}
                        {s.proposedById === user.id ? " · proposed by you" : " · proposed by student"}
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
                            description="The student will see the session as declined."
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
                      {s.status === "CONFIRMED" ? (
                        <form action={completeSessionAction}>
                          <input type="hidden" name="sessionId" value={s.id} />
                          <SubmitButton size="sm" pendingLabel="Working…">
                            Mark complete
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
                <form action={proposeSessionAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <input type="hidden" name="back" value="/mentor" />
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
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Proposing…">
                    Propose session
                  </SubmitButton>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!profile && !dbError ? (
        <EmptyState
          compact
          icon={Inbox}
          title="No requests yet"
          description="Create your profile above — once approved, students can request mentorship."
        />
      ) : null}
    </>
  );
}
