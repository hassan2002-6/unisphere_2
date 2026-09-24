import { requireCapability } from "@/lib/auth";
import { listManagedInternships } from "@/server/services/internships";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createInternshipAction, setInternshipStatusAction, updateApplicationAction } from "../../internships/actions";

export const dynamic = "force-dynamic";

export default async function AdminInternshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireCapability("internships.post");
  const { created, error } = await searchParams;

  let internships: Awaited<ReturnType<typeof listManagedInternships>> | null = null;
  try {
    internships = await listManagedInternships();
  } catch {
    internships = null;
  }

  return (
    <main className="space-y-4 p-6">
      {created ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Internship posted — students can apply immediately.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Internships (Manage)</h1>
        <p className="text-sm text-muted-foreground">
          Post openings and move applications through shortlist → accept/reject.
        </p>
      </div>

      {internships === null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internships unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {internships.map((i) => (
            <Card key={i.id}>
              <CardHeader className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {i.title} <span className="text-sm font-normal text-muted-foreground">— {i.company}</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i.applications.length} applicants</Badge>
                    {i.status === "OPEN" ? <Badge variant="secondary">Open</Badge> : <Badge variant="outline">Closed</Badge>}
                    <form action={setInternshipStatusAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="status" value={i.status === "OPEN" ? "CLOSED" : "OPEN"} />
                      <Button type="submit" variant="ghost" size="sm">
                        {i.status === "OPEN" ? "Close" : "Reopen"}
                      </Button>
                    </form>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">{i.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {i.applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No applications yet.</p>
                ) : (
                  i.applications.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{a.student.name}</span>{" "}
                          <span className="text-muted-foreground">
                            {a.student.registrationNo ? `· ${a.student.registrationNo} ` : ""}· {a.student.email}
                          </span>
                        </p>
                        {a.note ? <p className="text-xs text-muted-foreground">{a.note}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        {a.status === "APPLIED" || a.status === "SHORTLISTED" ? (
                          <form action={updateApplicationAction} className="flex items-center gap-1">
                            <input type="hidden" name="applicationId" value={a.id} />
                            {a.status === "APPLIED" ? (
                              <Button type="submit" name="status" value="SHORTLISTED" variant="secondary" size="sm">
                                Shortlist
                              </Button>
                            ) : null}
                            <Button
                              type="submit"
                              name="status"
                              value="ACCEPTED"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              Accept
                            </Button>
                            <Button type="submit" name="status" value="REJECTED" variant="destructive" size="sm">
                              Reject
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Post an internship</CardTitle>
          <CardDescription>Posted opportunities appear on /internships instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createInternshipAction} className="grid max-w-2xl gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input id="title" name="title" required placeholder="Software Engineering Intern" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company">
                  Company <span className="text-destructive">*</span>
                </Label>
                <Input id="company" name="company" required placeholder="Systems Ltd" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea id="description" name="description" rows={4} required minLength={20} maxLength={4000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="Karachi (hybrid)" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mode">Mode</Label>
                <Input id="mode" name="mode" placeholder="On-site / Hybrid / Remote" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="stipend">Stipend</Label>
                <Input id="stipend" name="stipend" placeholder="Paid / Unpaid" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" name="deadline" type="date" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="applyUrl">External link</Label>
                <Input id="applyUrl" name="applyUrl" placeholder="https://…" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" name="tags" placeholder="react, node, internship" />
              </div>
            </div>
            <Button type="submit" className="w-fit">
              Post internship
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
