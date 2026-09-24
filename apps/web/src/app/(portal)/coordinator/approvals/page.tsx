import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Cross-module approval overview for coordinators (approvals hub). */
export default async function CoordinatorApprovalsPage() {
  const user = await requireUser();

  if (!can(user.role, "forms.review")) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No access</CardTitle>
            <CardDescription>Approvals are limited to coordinators and faculty.</CardDescription>
          </CardHeader>
        </Card>
      </main>
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

  const tiles = [
    { label: "Form submissions awaiting review", value: pendingForms, href: "/reviews", show: can(user.role, "forms.review") },
    { label: "Open complaints", value: openComplaints, href: "/coordinator/complaints", show: can(user.role, "complaints.manage") },
    { label: "FYP applications pending", value: fypPending, href: "/admin/fyp", show: can(user.role, "fyp.decide") },
  ];

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Everything waiting on a human decision, across modules — jump straight to the queue.
        </p>
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval counts unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {tiles
            .filter((t) => t.show)
            .map((t) => (
              <Card key={t.label}>
                <CardHeader className="py-4">
                  <CardTitle className="text-3xl font-semibold tabular-nums">{t.value}</CardTitle>
                  <CardDescription>{t.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={t.href}>Open queue</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </main>
  );
}
