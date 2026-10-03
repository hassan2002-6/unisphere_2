import { Briefcase, Clock, Inbox, Users } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listManagedInternships } from "@/server/services/internships";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  const openCount = internships?.filter((i) => i.status === "OPEN").length ?? 0;
  const applicationCount = internships?.reduce((n, i) => n + i.applications.length, 0) ?? 0;
  const awaitingDecision =
    internships?.reduce(
      (n, i) => n + i.applications.filter((a) => a.status === "APPLIED" || a.status === "SHORTLISTED").length,
      0,
    ) ?? 0;

  return (
    <>
      <PageHeader
        icon={Briefcase}
        title="Internships (Manage)"
        description="Post openings and move applications through shortlist → accept/reject."
      />

      {created ? (
        <Alert variant="success">
          <AlertTitle>Internship posted</AlertTitle>
          <AlertDescription>Students can apply immediately from /internships.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t post the internship</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {internships === null ? (
        <Alert variant="destructive">
          <AlertTitle>Internships unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : internships.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No internships posted yet"
          description="Use the form below to post the first opening — it appears on /internships instantly and students can apply right away."
        />
      ) : (
        <>
          <section aria-label="Internship summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Postings"
              value={internships.length}
              hint={`${openCount} open · ${internships.length - openCount} closed`}
              icon={Briefcase}
              tone="primary"
            />
            <StatCard label="Applications" value={applicationCount} hint="Across all postings" icon={Users} tone="info" />
            <StatCard
              label="Awaiting decision"
              value={awaitingDecision}
              hint={awaitingDecision > 0 ? "Shortlist or accept/reject" : "Application queue is clear"}
              icon={Clock}
              tone={awaitingDecision > 0 ? "warning" : "success"}
            />
          </section>

          <div className="space-y-4">
            {internships.map((i) => (
              <Card key={i.id} className="gap-0 overflow-hidden py-0">
                <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      {i.title} <span className="text-sm font-normal text-muted-foreground">— {i.company}</span>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{i.description}</CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">{i.applications.length} applicants</Badge>
                    {i.status === "OPEN" ? <Badge variant="secondary">Open</Badge> : <Badge variant="outline">Closed</Badge>}
                    <ConfirmAction
                      action={setInternshipStatusAction}
                      values={{ id: i.id, status: i.status === "OPEN" ? "CLOSED" : "OPEN" }}
                      title={i.status === "OPEN" ? "Close this posting?" : "Reopen this posting?"}
                      description={i.status === "OPEN" ? "It stops accepting applications until you reopen it." : "Students will be able to apply again right away."}
                      confirmLabel={i.status === "OPEN" ? "Close posting" : "Reopen posting"}
                      trigger={
                        <Button variant="ghost" size="sm">
                          {i.status === "OPEN" ? "Close" : "Reopen"}
                        </Button>
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {i.applications.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        compact
                        icon={Inbox}
                        title="No applications yet"
                        description="Student applications show up here the moment they arrive."
                      />
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {i.applications.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{a.student.name}</span>{" "}
                              <span className="text-muted-foreground">
                                {a.student.registrationNo ? `· ${a.student.registrationNo} ` : ""}· {a.student.email}
                              </span>
                            </p>
                            {a.note ? <p className="mt-0.5 text-xs text-muted-foreground">{a.note}</p> : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <StatusBadge status={a.status} />
                            {a.status === "APPLIED" || a.status === "SHORTLISTED" ? (
                              <div className="flex items-center gap-1.5">
                                {a.status === "APPLIED" ? (
                                  <ConfirmAction
                                    action={updateApplicationAction}
                                    values={{ applicationId: a.id, status: "SHORTLISTED" }}
                                    title="Shortlist this application?"
                                    description={`${a.student.name} moves to the shortlist — you can still accept or reject them afterwards.`}
                                    confirmLabel="Shortlist"
                                    trigger={
                                      <Button variant="secondary" size="sm">
                                        Shortlist
                                      </Button>
                                    }
                                  />
                                ) : null}
                                <ConfirmAction
                                  action={updateApplicationAction}
                                  values={{ applicationId: a.id, status: "ACCEPTED" }}
                                  title="Accept this application?"
                                  description={`${a.student.name} will be marked as accepted for ${i.title}.`}
                                  confirmLabel="Accept"
                                  trigger={
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                      Accept
                                    </Button>
                                  }
                                />
                                <ConfirmAction
                                  action={updateApplicationAction}
                                  values={{ applicationId: a.id, status: "REJECTED" }}
                                  title="Reject this application?"
                                  description={`${a.student.name} will be marked as rejected for ${i.title}.`}
                                  confirmLabel="Reject"
                                  variant="destructive"
                                  trigger={
                                    <Button variant="destructive" size="sm">
                                      Reject
                                    </Button>
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
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
            <SubmitButton className="w-fit" pendingLabel="Posting…">
              Post internship
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
