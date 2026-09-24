import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listManagedComplaints } from "@/server/services/complaints";
import { ComplaintManager } from "@/components/complaint-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CoordinatorComplaintsPage() {
  const user = await requireUser();

  if (!can(user.role, "complaints.manage")) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No access</CardTitle>
            <CardDescription>Complaint management is limited to faculty and coordinators.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  let data: Awaited<ReturnType<typeof listManagedComplaints>> | null = null;
  try {
    data = await listManagedComplaints(user);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Complaints unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <ComplaintManager
      items={data.items}
      labels={{
        title: "Complaints (Coordinator)",
        description: "All complaints across categories — start review, resolve or close, with a note to the submitter.",
      }}
    />
  );
}
