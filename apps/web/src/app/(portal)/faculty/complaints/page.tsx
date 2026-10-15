import { MessageSquareWarning } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listManagedComplaints } from "@/server/services/complaints";
import { ComplaintManager } from "@/components/complaint-manager";
import { ComplaintFilters } from "@/components/complaint-filters";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function FacultyComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; overdue?: string; q?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;

  if (!can(user.role, "complaints.manage")) {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title="Complaints (Faculty)" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Complaint management is limited to faculty and coordinators.</AlertDescription>
        </Alert>
      </>
    );
  }

  let data: Awaited<ReturnType<typeof listManagedComplaints>> | null = null;
  try {
    data = await listManagedComplaints(user, {
      status: filters.status,
      priority: filters.priority,
      overdueOnly: filters.overdue === "1",
      q: filters.q,
    });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title="Complaints (Faculty)" />
        <Alert variant="destructive">
          <AlertTitle>Complaints unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <ComplaintManager
      items={data.items}
      labels={{
        title: "Complaints (Faculty)",
        description: "Faculty-category complaints and anything assigned to you.",
      }}
      toolbar={
        <ComplaintFilters
          status={filters.status ?? ""}
          priority={filters.priority ?? ""}
          overdue={filters.overdue === "1"}
          q={filters.q ?? ""}
        />
      }
    />
  );
}
