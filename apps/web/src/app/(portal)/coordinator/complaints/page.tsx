import { MessageSquareWarning } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ComplaintOffice } from "@/components/complaint-office";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function CoordinatorComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string; status?: string; priority?: string; overdue?: string; q?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;

  if (!can(user.role, "complaints.manage")) {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title="Complaints (Coordinator)" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Complaint management is limited to faculty and coordinators.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <ComplaintOffice
      user={user}
      basePath="/coordinator/complaints"
      labels={{
        title: "Complaints (Coordinator)",
        description: "Your recipient inbox plus the full desk — all complaints across categories.",
      }}
      filters={filters}
    />
  );
}
