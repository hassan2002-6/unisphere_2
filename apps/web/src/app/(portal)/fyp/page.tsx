import { GraduationCap, Rocket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMyFypApplications } from "@/server/services/fyp";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createFypAction, resubmitFypAction } from "./actions";

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
    <>
      <PageHeader
        icon={GraduationCap}
        title="FYP Application"
        description="Submit your FYP-II proposal — approved applications unlock resource allocations."
      />

      {created ? (
        <Alert variant="success">
          <AlertTitle>Application submitted</AlertTitle>
          <AlertDescription>The FYP Head will review it.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Application not submitted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>FYP data unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check DATABASE_URL and the Neon project.</AlertDescription>
        </Alert>
      ) : null}

      {applications.length > 0 ? (
        <section className="space-y-2">
          {applications.map((a) => (
            <Card key={a.id} className="gap-0 py-0">
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.groupName} · {a.members}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.domain} · {a.technologies}
                    {a.supervisorPref ? ` · supervisor pref: ${a.supervisorPref}` : ""}
                  </p>
                  {a.supervisor ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      Supervisor: {a.supervisor.name}
                      {a.supervisor.employeeId ? ` (${a.supervisor.employeeId})` : ""}
                    </p>
                  ) : null}
                  {a.remarks ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Remarks from {a.decidedBy?.name ?? "reviewer"}: {a.remarks}
                    </p>
                  ) : null}
                  {a.progressUpdates.length > 0 ? (
                    <details className="mt-2 rounded-lg border bg-muted/20 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-primary">
                        Supervisor progress notes ({a.progressUpdates.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {a.progressUpdates.map((u) => (
                          <div key={u.id}>
                            <p className="text-xs">{u.note}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {u.author.name} ·{" "}
                              {u.createdAt.toLocaleString("en-GB", {
                                timeZone: "Asia/Karachi",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  {a.status === "CHANGES_REQUESTED" && a.applicantId === user.id ? (
                    <details className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-primary">
                        Revision requested — revise & resubmit
                      </summary>
                      <form action={resubmitFypAction} className="mt-3 grid max-w-2xl gap-3">
                        <input type="hidden" name="id" value={a.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label htmlFor={`title-${a.id}`}>Project title</Label>
                            <Input id={`title-${a.id}`} name="title" defaultValue={a.title} required minLength={6} maxLength={200} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`domain-${a.id}`}>Domain</Label>
                            <Input id={`domain-${a.id}`} name="domain" defaultValue={a.domain} required />
                          </div>
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`description-${a.id}`}>Description</Label>
                          <Textarea
                            id={`description-${a.id}`}
                            name="description"
                            rows={4}
                            defaultValue={a.description}
                            required
                            minLength={50}
                            maxLength={4000}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label htmlFor={`technologies-${a.id}`}>Technologies</Label>
                            <Input id={`technologies-${a.id}`} name="technologies" defaultValue={a.technologies} required />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`supervisorPref-${a.id}`}>Supervisor preference</Label>
                            <Input
                              id={`supervisorPref-${a.id}`}
                              name="supervisorPref"
                              defaultValue={a.supervisorPref ?? ""}
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="grid gap-1.5">
                            <Label htmlFor={`groupName-${a.id}`}>Group name</Label>
                            <Input id={`groupName-${a.id}`} name="groupName" defaultValue={a.groupName} required />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`members-${a.id}`}>Members</Label>
                            <Input id={`members-${a.id}`} name="members" defaultValue={a.members} required />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`registrationNos-${a.id}`}>Registration nos.</Label>
                            <Input id={`registrationNos-${a.id}`} name="registrationNos" defaultValue={a.registrationNos} required />
                          </div>
                        </div>
                        <input type="hidden" name="department" value={a.department} />
                        <input type="hidden" name="semester" value={a.semester} />
                        <SubmitButton pendingLabel="Resubmitting…" size="sm" className="w-fit">
                          Resubmit for review
                        </SubmitButton>
                      </form>
                    </details>
                  ) : null}
                </div>
                <StatusBadge status={a.status} />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {user.role === "STUDENT" && canApply ? (
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Rocket className="h-4 w-4 text-muted-foreground" />
              New application
            </CardTitle>
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
              <SubmitButton pendingLabel="Submitting…" className="w-fit">
                Submit application
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      ) : user.role === "STUDENT" ? (
        <Alert variant="muted">
          <AlertTitle>Application limit reached</AlertTitle>
          <AlertDescription>
            You already have 2 applications (the cap for a semester). Withdraw one to submit another.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="muted">
          <AlertTitle>Reviewer view</AlertTitle>
          <AlertDescription>
            You see your own applications here; use <Badge variant="secondary">FYP Applications</Badge> in the sidebar to
            review student submissions.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
