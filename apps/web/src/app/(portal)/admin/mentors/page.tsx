import { Clock, Handshake, UserCheck } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listAllMentorProfiles } from "@/server/services/mentorship";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <>
        <PageHeader icon={Handshake} title="Mentors" />
        <Alert variant="destructive">
          <AlertTitle>Mentor profiles unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const pending = profiles.filter((p) => !p.isApproved);
  const live = profiles.length - pending.length;

  return (
    <>
      <PageHeader
        icon={Handshake}
        title="Mentors"
        description="Approve, pause and audit mentor profiles."
      />

      <section aria-label="Mentor summary" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Awaiting approval"
          value={pending.length}
          hint={pending.length > 0 ? "Approve to add them to the directory" : "No pending requests"}
          icon={Clock}
          tone={pending.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Live in the directory"
          value={live}
          hint="Visible to students on /mentorship"
          icon={UserCheck}
          tone={live > 0 ? "success" : "default"}
        />
      </section>

      {profiles.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No mentor profiles yet"
          description="Users create mentor profiles from the Mentor Console — submissions land here for approval."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-base">Mentor profiles ({profiles.length})</CardTitle>
            <CardDescription>Only approved mentors appear to students on /mentorship.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {profiles.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{p.user.name}</span>{" "}
                      <span className="text-muted-foreground">· {p.headline}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.user.email} · {p.user.role}
                      {p.company ? ` · ${p.company}` : ""}
                    </p>
                    {p.bio ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.bio}</p> : null}
                    <div className="flex flex-wrap gap-1">
                      {p.expertise.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={p.isApproved ? "APPROVED" : "PENDING"} />
                    <ConfirmAction
                      action={setMentorApprovalAction}
                      values={{ userId: p.user.id, approved: p.isApproved ? "false" : "true" }}
                      title={p.isApproved ? "Pause this mentor?" : "Approve this mentor?"}
                      description={
                        p.isApproved
                          ? "Their profile is hidden from the student-facing mentorship directory until re-approved."
                          : "They will appear to students in the mentorship directory right away."
                      }
                      confirmLabel={p.isApproved ? "Pause" : "Approve"}
                      variant={p.isApproved ? "destructive" : "default"}
                      trigger={
                        <Button variant={p.isApproved ? "outline" : "default"} size="sm">
                          {p.isApproved ? "Pause" : "Approve"}
                        </Button>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
