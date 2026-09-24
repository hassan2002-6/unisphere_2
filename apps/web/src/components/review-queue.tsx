import { formFieldsSchema } from "@/lib/validation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { decideAction } from "@/app/(portal)/forms/actions";

type QueueItem = {
  id: string;
  status: string;
  payload: unknown;
  createdAt: Date;
  template: { title: string; audienceRole: string };
  submittedBy: { name: string; email: string; registrationNo: string | null };
};

function renderValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/**
 * Shared review queue for FACULTY / COORDINATOR / FYP_HEAD (routes
 * /reviews and /faculty/reviews render it; the action re-checks the role).
 */
export function ReviewQueue({
  items,
  labels,
}: {
  items: QueueItem[];
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
            <CardTitle className="text-base">Queue is empty</CardTitle>
            <CardDescription>Nothing is waiting on you right now.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const fields = formFieldsSchema.safeParse(
              // payload keys only; we re-render from the raw payload below
              Object.entries((s.payload ?? {}) as Record<string, unknown>).map(([name, v]) => ({
                name,
                label: name,
                type: typeof v === "boolean" ? ("checkbox" as const) : ("text" as const),
              })),
            );
            const entries = Object.entries((s.payload ?? {}) as Record<string, unknown>);
            return (
              <Card key={s.id}>
                <CardHeader className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{s.template.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.template.audienceRole.toLowerCase()}</Badge>
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                  <CardDescription>
                    {s.submittedBy.name}
                    {s.submittedBy.registrationNo ? ` · ${s.submittedBy.registrationNo}` : ""} ·{" "}
                    {s.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-1.5 text-sm">
                    {(fields.success ? entries : []).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="w-36 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {key}
                        </span>
                        <span>{renderValue(value)}</span>
                      </div>
                    ))}
                  </div>

                  <form action={decideAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <div className="grid min-w-56 flex-1 gap-1.5">
                      <label htmlFor={`comment-${s.id}`} className="text-xs font-medium text-muted-foreground">
                        Comment (sent to {s.submittedBy.name.split(" ")[0]})
                      </label>
                      <Textarea id={`comment-${s.id}`} name="comment" rows={2} placeholder="Optional note…" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {s.status === "SUBMITTED" ? (
                        <Button type="submit" name="decision" value="UNDER_REVIEW" variant="secondary" size="sm">
                          Start review
                        </Button>
                      ) : null}
                      <div className="flex gap-2">
                        <Button type="submit" name="decision" value="APPROVED" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Approve
                        </Button>
                        <Button type="submit" name="decision" value="REJECTED" variant="destructive" size="sm">
                          Reject
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
