import { requireCapability } from "@/lib/auth";
import { listAllMentorProfiles } from "@/server/services/mentorship";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setMentorApprovalAction } from "@/app/(portal)/mentorship/actions";

export const dynamic = "force-dynamic";

export default async function AdminMentorsPage() {
  await requireCapability("mentors.approve");

  let profiles: Awaited<ReturnType<typeof listAllMentorProfiles>> | null = null;
  try {
    profiles = await listAllMentorProfiles();
  } catch {
    profiles = null;
  }

  if (!profiles) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mentor profiles unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const pending = profiles.filter((p) => !p.isApproved);

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mentors</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} awaiting approval · {profiles.length - pending.length} live in the directory.
        </p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Mentor profiles ({profiles.length})</CardTitle>
          <CardDescription>Only approved mentors appear to students on /mentorship.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mentor profiles yet — users create them from the Mentor Console.
            </p>
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{p.user.name}</span>{" "}
                    <span className="text-muted-foreground">· {p.headline}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.user.email} · {p.user.role}
                    {p.company ? ` · ${p.company}` : ""}
                  </p>
                  {p.bio ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.bio}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.expertise.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.isApproved ? <Badge variant="secondary">Approved</Badge> : <Badge variant="outline">Pending</Badge>}
                  <form action={setMentorApprovalAction}>
                    <input type="hidden" name="userId" value={p.user.id} />
                    <input type="hidden" name="approved" value={p.isApproved ? "false" : "true"} />
                    <Button type="submit" variant={p.isApproved ? "outline" : "default"} size="sm">
                      {p.isApproved ? "Pause" : "Approve"}
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
