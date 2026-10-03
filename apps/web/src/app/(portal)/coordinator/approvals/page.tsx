import { ClipboardList, GraduationCap, MessageSquareWarning } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { StatTone } from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/** Cross-module approval overview for coordinators (approvals hub). */
export default async function CoordinatorApprovalsPage() {
  const user = await requireUser();

  if (!can(user.role, "forms.review")) {
    return (
      <>
        <PageHeader icon={ClipboardList} title="Approvals" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Approvals are limited to coordinators and faculty.</AlertDescription>
        </Alert>
      </>
    );
  }

  let pendingForms = 0;
  let openComplaints = 0;
  let fypPending = 0;
  let dbError = false;
  try {
    [pendingForms, openComplaints, fypPending] = await Promise.all([
      prisma.formSubmission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
      prisma.fypApplication.count({ where: { status: "PENDING" } }),
    ]);
  } catch {
    dbError = true;
  }

  const tiles: { label: string; value: number; hint: string; href: string; icon: LucideIcon; tone: StatTone; show: boolean }[] = [
    { label: "Form submissions awaiting review", value: pendingForms, hint: "Submitted or in review", href: "/reviews", icon: ClipboardList, tone: "primary", show: can(user.role, "forms.review") },
    { label: "Open complaints", value: openComplaints, hint: "Awaiting first response", href: "/coordinator/complaints", icon: MessageSquareWarning, tone: "warning", show: can(user.role, "complaints.manage") },
    { label: "FYP applications pending", value: fypPending, hint: "Awaiting a decision", href: "/admin/fyp", icon: GraduationCap, tone: "info", show: can(user.role, "fyp.decide") },
  ];
  const visible = tiles.filter((t) => t.show);

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="Approvals"
        description="Everything waiting on a human decision, across modules — jump straight to the queue."
      />

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Approval counts unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : (
        <>
          <section aria-label="Approval queues" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <StatCard key={t.label} label={t.label} value={t.value} hint={t.hint} icon={t.icon} tone={t.tone} href={t.href} />
            ))}
          </section>

          {visible.every((t) => t.value === 0) ? (
            <Alert variant="muted">
              <AlertTitle>All caught up</AlertTitle>
              <AlertDescription>
                Nothing is waiting for a decision right now — queues update live as new items arrive.
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
    </>
  );
}
