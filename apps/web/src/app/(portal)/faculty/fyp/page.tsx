import { ClipboardList, GraduationCap, MessageSquarePlus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listSupervisedApplications } from "@/server/services/fyp";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { StatTone } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { addProgressNoteAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Faculty FYP supervision workspace (spec §12): the projects you supervise —
 * group details, full progress history, and a place to add remarks that the
 * students are notified about.
 */
export default async function FacultyFypPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireCapability("students.search");
  const { saved, error } = await searchParams;

  let projects: Awaited<ReturnType<typeof listSupervisedApplications>> = [];
  let dbError = false;
  try {
    projects = await listSupervisedApplications(me);
  } catch {
    dbError = true;
  }

  const totalNotes = projects.reduce((sum, p) => sum + p.progressUpdates.length, 0);
  const tiles: { label: string; value: number; hint: string; icon: LucideIcon; tone: StatTone }[] = [
    { label: "Supervised groups", value: projects.length, hint: "Assigned to you", icon: Users, tone: projects.length ? "primary" : "default" },
    { label: "Progress notes", value: totalNotes, hint: "Recorded against your projects", icon: ClipboardList, tone: "info" },
  ];

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="FYP Supervision"
        description="The Final Year Projects you supervise. Progress remarks are saved to the project log and the group is notified — students see them on their FYP page."
      />

      {saved ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{saved}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Projects unavailable</AlertTitle>
          <AlertDescription>The database didn&apos;t answer — try again in a moment.</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Supervision numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatCard key={t.label} {...t} />
        ))}
      </section>

      {projects.length === 0 && !dbError ? (
        <EmptyState
          icon={GraduationCap}
          title="No supervised projects yet"
          description="When the FYP Head approves a group and assigns you as supervisor, the project appears here with its group details and progress log."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="gap-0 overflow-hidden py-0">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-semibold">{p.title}</CardTitle>
                  <Badge variant="secondary">{p.groupName}</Badge>
                  <Badge variant="outline">{p.domain}</Badge>
                  <StatusBadge status={p.status} />
                </div>
                <span className="text-xs text-muted-foreground">{p.semester}</span>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-4">
                <div className="grid gap-2 text-[13px] sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Members:</span> {p.members}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Registration nos:</span> {p.registrationNos}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Applicant:</span> {p.applicant.name}
                    {p.applicant.registrationNo ? ` (${p.applicant.registrationNo})` : ""} · {p.applicant.email}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Department:</span> {p.department}
                  </p>
                </div>
                <p className="text-[13px] text-muted-foreground">{p.description}</p>

                <form action={addProgressNoteAction} className="space-y-2">
                  <input type="hidden" name="applicationId" value={p.id} />
                  <Textarea
                    name="note"
                    rows={2}
                    required
                    placeholder="Progress remark — e.g. “Literature review received; refine the evaluation plan before the next demo.”"
                    aria-label={`Progress note for ${p.title}`}
                  />
                  <SubmitButton size="sm" pendingLabel="Saving…">
                    <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add progress note
                  </SubmitButton>
                </form>

                <div className="divide-y rounded-lg border">
                  {p.progressUpdates.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-muted-foreground">No progress notes yet.</p>
                  ) : (
                    p.progressUpdates.map((u) => (
                      <div key={u.id} className="px-3.5 py-2.5">
                        <p className="text-[13px]">{u.note}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
