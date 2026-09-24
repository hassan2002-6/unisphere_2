import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { complaintTransitionAction } from "@/app/(portal)/complaints/actions";

type ManagedComplaint = {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  createdAt: Date;
  submittedBy: { name: string; registrationNo: string | null };
  assignedTo: { name: string } | null;
};

/** Shared management list for /coordinator/complaints and /faculty/complaints. */
export function ComplaintManager({
  items,
  labels,
}: {
  items: ManagedComplaint[];
  labels: { title: string; description: string };
}) {
  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
        <p className="text-sm text-muted-foreground">{labels.description}</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No complaints in your scope</CardTitle>
            <CardDescription>New complaints will appear here as soon as they&apos;re filed.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardHeader className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{c.subject}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{c.category}</Badge>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                <CardDescription>
                  {c.submittedBy.name}
                  {c.submittedBy.registrationNo ? ` · ${c.submittedBy.registrationNo}` : ""} ·{" "}
                  {c.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {c.assignedTo ? ` · assigned to ${c.assignedTo.name}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{c.description}</p>

                <form action={complaintTransitionAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="min-w-52 flex-1">
                    <Input name="comment" placeholder="Note to the submitter (optional)" className="h-9" />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" name="assignToMe" className="size-3.5 accent-primary" />
                    assign to me
                  </label>
                  <div className="flex gap-2">
                    {c.status === "OPEN" ? (
                      <Button type="submit" name="status" value="IN_REVIEW" variant="secondary" size="sm">
                        Start review
                      </Button>
                    ) : null}
                    {c.status === "IN_REVIEW" ? (
                      <>
                        <Button type="submit" name="status" value="RESOLVED" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Resolve
                        </Button>
                        <Button type="submit" name="status" value="CLOSED" variant="outline" size="sm">
                          Close
                        </Button>
                      </>
                    ) : null}
                    {c.status === "RESOLVED" ? (
                      <Button type="submit" name="status" value="CLOSED" variant="outline" size="sm">
                        Close
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
