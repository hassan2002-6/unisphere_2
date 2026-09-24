import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Stat = { label: string; value: string | number };

async function loadStats(userId: string, role: Role): Promise<Stat[]> {
  switch (role) {
    case "STUDENT": {
      const [forms, complaints, fyp, unread] = await Promise.all([
        prisma.formSubmission.count({ where: { submittedById: userId } }),
        prisma.complaint.count({ where: { submittedById: userId, status: { in: ["OPEN", "IN_REVIEW"] } } }),
        prisma.fypApplication.count({ where: { applicantId: userId } }),
        prisma.notification.count({ where: { userId, readAt: null } }),
      ]);
      return [
        { label: "My form submissions", value: forms },
        { label: "Open complaints", value: complaints },
        { label: "FYP applications", value: fyp },
        { label: "Unread notifications", value: unread },
      ];
    }
    case "FACULTY": {
      const [toReview, courses, complaints] = await Promise.all([
        prisma.formSubmission.count({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, template: { reviewerRole: "FACULTY" } },
        }),
        prisma.courseClass.count({ where: { facultyId: userId } }),
        prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] }, category: "Faculty" } }),
      ]);
      return [
        { label: "Forms awaiting review", value: toReview },
        { label: "My courses", value: courses },
        { label: "Faculty complaints", value: complaints },
      ];
    }
    case "COORDINATOR": {
      const [toReview, openComplaints, internships] = await Promise.all([
        prisma.formSubmission.count({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, template: { reviewerRole: "COORDINATOR" } },
        }),
        prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
        prisma.internship.count({ where: { status: "OPEN" } }),
      ]);
      return [
        { label: "Forms awaiting review", value: toReview },
        { label: "Open complaints", value: openComplaints },
        { label: "Open internships", value: internships },
      ];
    }
    case "FYP_HEAD": {
      const [pendingFyp, pendingRequests, activeAllocations] = await Promise.all([
        prisma.fypApplication.count({ where: { status: "PENDING" } }),
        prisma.resourceRequest.count({ where: { status: { in: ["PENDING", "RECOMMENDED"] } } }),
        prisma.allocation.count({ where: { status: "ACTIVE" } }),
      ]);
      return [
        { label: "FYP applications pending", value: pendingFyp },
        { label: "Resource requests open", value: pendingRequests },
        { label: "Active allocations", value: activeAllocations },
      ];
    }
    case "MENTOR": {
      const [pending, active, sessions] = await Promise.all([
        prisma.mentorshipRequest.count({ where: { mentorId: userId, status: "PENDING" } }),
        prisma.mentorshipRequest.count({ where: { mentorId: userId, status: "ACCEPTED" } }),
        prisma.mentorshipSession.count({
          where: { request: { mentorId: userId }, status: { in: ["PROPOSED", "CONFIRMED"] } },
        }),
      ]);
      return [
        { label: "Pending requests", value: pending },
        { label: "Active mentees", value: active },
        { label: "Upcoming sessions", value: sessions },
      ];
    }
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  let stats: Stat[] | null = null;
  let dbError = false;
  if (process.env.DATABASE_URL) {
    try {
      stats = await loadStats(user.id, user.role);
    } catch {
      dbError = true;
    }
  }

  return (
    <main className="space-y-6 p-6">
      {denied ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          You don&apos;t have access to that page with your current role.
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABELS[user.role]} portal · Salim Habib University
        </p>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {dbError ? "Database unreachable" : "Database not connected yet"}
            </CardTitle>
            <CardDescription>
              {dbError
                ? "DATABASE_URL is set but the database did not answer. Check the Neon project and connection string."
                : "Set DATABASE_URL (see .env.example) and run `prisma migrate dev && bun run seed` to unlock live data."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The portal shell, role navigation and auth are functional — module data arrives with the
            database connection.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
