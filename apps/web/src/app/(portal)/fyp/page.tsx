import { requireUser } from "@/lib/auth";
import { listMyFypApplications } from "@/server/services/fyp";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createFypAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function FypPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { created, error } = await searchParams;

  let applications: Awaited<ReturnType<typeof listMyFypApplications>> = [];
  let dbError = false;
  try {
    applications = await listMyFypApplications(user);
  } catch {
    dbError = true;
  }

  const canApply = user.role === "STUDENT" && applications.length < 2;

  return (
    <main className="space-y-4 p-6">
      {created ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Application submitted — the FYP Head will review it.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">FYP Application</h1>
        <p className="text-sm text-muted-foreground">
          Submit your FYP-II proposal — approved applications unlock resource allocations.
        </p>
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FYP data unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {applications.length > 0 ? (
        <div className="space-y-2">
          {applications.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.groupName} · {a.members}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.domain} · {a.technologies}
                    {a.supervisorPref ? ` · supervisor pref: ${a.supervisorPref}` : ""}
                  </p>
                  {a.remarks ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Remarks from {a.decidedBy?.name ?? "reviewer"}: {a.remarks}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={a.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {user.role === "STUDENT" && canApply ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">New application</CardTitle>
            <CardDescription>Both FYP-I and FYP-II details are welcome — the committee reads everything.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createFypAction} className="grid max-w-2xl gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  Project title <span className="text-destructive">*</span>
                </Label>
                <Input id="title" name="title" required minLength={6} maxLength={200} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" name="domain" placeholder="e.g. Web Engineering / EdTech" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="technologies">Technologies</Label>
                  <Input id="technologies" name="technologies" placeholder="Next.js, PostgreSQL, …" required />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea id="description" name="description" rows={5} required minLength={50} maxLength={4000} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="groupName">Group name</Label>
                  <Input id="groupName" name="groupName" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="members">Members</Label>
                  <Input id="members" name="members" placeholder="A, B, C" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="registrationNos">Registration nos.</Label>
                  <Input id="registrationNos" name="registrationNos" placeholder="23-0001, 23-0002" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="supervisorPref">Supervisor preference</Label>
                  <Input id="supervisorPref" name="supervisorPref" placeholder="Optional" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" name="department" defaultValue={user.department ?? "Computer Science"} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="semester">Semester</Label>
                  <Input id="semester" name="semester" defaultValue="Fall 2026" required />
                </div>
              </div>
              <Button type="submit" className="w-fit">
                Submit application
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : user.role === "STUDENT" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application limit reached</CardTitle>
            <CardDescription>
              You already have 2 applications (the cap for a semester). Withdraw one to submit another.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Reviewer view</CardTitle>
            <CardDescription>
              You see your own applications here; use{" "}
              <Badge variant="secondary">FYP Applications</Badge> in the sidebar to review student submissions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
