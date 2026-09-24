import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listReviewQueue } from "@/server/services/forms";
import { ReviewQueue } from "@/components/review-queue";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FacultyReviewsPage() {
  const user = await requireUser();

  if (!can(user.role, "forms.review")) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No review access</CardTitle>
            <CardDescription>The review queue is only available to faculty, coordinators and the FYP Head.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  let data: Awaited<ReturnType<typeof listReviewQueue>> | null = null;
  try {
    data = await listReviewQueue(user);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review queue unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <ReviewQueue
      items={data.items}
      labels={{
        title: "Review Queue (Faculty)",
        description: "Submissions routed to faculty — approve, reject, or start a review with a comment.",
      }}
    />
  );
}
