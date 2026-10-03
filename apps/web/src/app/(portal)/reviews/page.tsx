import { Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listReviewQueue } from "@/server/services/forms";
import { ReviewQueue } from "@/components/review-queue";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const user = await requireUser();

  if (!can(user.role, "forms.review")) {
    return (
      <>
        <PageHeader icon={Inbox} title="Review Queue" />
        <Alert variant="warning">
          <AlertTitle>No review access</AlertTitle>
          <AlertDescription>
            The review queue is only available to faculty, coordinators and the FYP Head.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  let data: Awaited<ReturnType<typeof listReviewQueue>> | null = null;
  try {
    data = await listReviewQueue(user);
  } catch (error) {
    console.error("review queue load failed:", error);
    data = null;
  }

  if (!data) {
    return (
      <>
        <PageHeader icon={Inbox} title="Review Queue" />
        <Alert variant="destructive">
          <AlertTitle>Review queue unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <ReviewQueue
      items={data.items}
      labels={{
        title: "Review Queue",
        description: "Form submissions routed to your role — decide with a comment; the submitter is notified instantly.",
      }}
    />
  );
}
