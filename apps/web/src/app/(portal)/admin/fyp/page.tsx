import { requireCapability } from "@/lib/auth";
import { listFypQueue } from "@/server/services/fyp";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { decideFypAction } from "@/app/(portal)/fyp/actions";

export const dynamic = "force-dynamic";

export default async function AdminFypPage() {
  await requireCapability("fyp.decide");

  let queue: Awaited<ReturnType<typeof listFypQueue>> | null = null;
  try {
    queue = await listFypQueue();
  } catch {
    queue = null;
  }

  if (!queue) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FYP queue unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const pending = queue.filter((q) => q.status === "PENDING");
  const decided = queue.filter((q) => q.status !== "PENDING");

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">FYP Applications</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} pending · {decided.length} decided — decisions notify the applicants immediately.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing pending</CardTitle>
            <CardDescription>New applications will appear here for a decision.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((a) => (
            <Card key={a.id}>
              <CardHeader className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <StatusBadge status={a.status} />
                </div>
                <CardDescription>
                  {a.applicant.name} · {a.groupName} · {a.members} ({a.registrationNos}) · {a.department}, {a.semester}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground">
                  Domain: {a.domain} · Tech: {a.technologies}
                  {a.supervisorPref ? ` · Supervisor pref: ${a.supervisorPref}` : ""}
                </p>
                <form action={decideFypAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <div className="min-w-64 flex-1">
                    <Input name="remarks" placeholder="Remarks (included in the notification)" className="h-9" />
                  </div>
                  <Button type="submit" name="decision" value="APPROVED" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    Approve
                  </Button>
                  <Button type="submit" name="decision" value="REJECTED" variant="destructive" size="sm">
                    Reject
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Decided ({decided.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {decided.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div>
                  <span className="font-medium">{a.title}</span>{" "}
                  <span className="text-muted-foreground">
                    · {a.applicant.name} · {a.groupName}
                  </span>
                  {a.remarks ? <p className="text-xs text-muted-foreground">Remarks: {a.remarks}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  {a.decidedBy ? <Badge variant="outline">by {a.decidedBy.name}</Badge> : null}
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
