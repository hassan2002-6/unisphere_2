import { requireUser } from "@/lib/auth";
import { getMentorProfileByUserId, listMentorRequests } from "@/server/services/mentorship";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    <main className="space-y-4 p-6">
      {saved ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Profile saved — approvals are handled by the FYP Head.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentor Console</h1>
          <p className="text-sm text-muted-foreground">
            {dbError
              ? "Database unavailable — check DATABASE_URL."
              : profile
                ? `Your directory listing is ${profile.isApproved ? "live" : "awaiting approval"}.`
                : "Set up your mentor profile to appear in the directory."}
          </p>
        </div>
        {profile ? (
          profile.isApproved ? <Badge variant="secondary">Approved</Badge> : <Badge variant="outline">Pending approval</Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Mentor profile</CardTitle>
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
            <Button type="submit" className="w-fit">
              {profile ? "Save profile" : "Create profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Pending requests ({pending.length})</CardTitle>
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
                <form action={respondToMentorshipAction} className="flex gap-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <Button type="submit" name="decision" value="ACCEPTED" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    Accept
                  </Button>
                  <Button type="submit" name="decision" value="DECLINED" variant="outline" size="sm">
                    Decline
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Active mentees ({active.length})</CardTitle>
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
                      {s.status === "CONFIRMED" ? (
                        <form action={completeSessionAction}>
                          <input type="hidden" name="sessionId" value={s.id} />
                          <Button type="submit" size="sm">
                            Mark complete
                          </Button>
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
                  <Button type="submit" size="sm" variant="secondary">
                    Propose session
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!profile && !dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No requests yet</CardTitle>
            <CardDescription>Create your profile — once approved, students can request mentorship.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </main>
  );
}
