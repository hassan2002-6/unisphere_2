import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ReviewActions } from "@/components/review-actions";
import { decideAction } from "@/app/(portal)/forms/actions";
import { Inbox, Paperclip } from "lucide-react";

type QueueItem = {
  id: string;
  status: string;
  payload: unknown;
  attachmentName?: string | null;
  createdAt: Date;
  template: { title: string; audienceRole: string };
  submittedBy: { name: string; email: string; registrationNo: string | null };
};

function renderValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** "courseCode" → "Course code" */
function prettify(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function waiting(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
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
    <>
      <PageHeader icon={Inbox} title={labels.title} description={labels.description} actions={
        <Badge variant={items.length > 0 ? "secondary" : "outline"} className="text-xs">
          {items.length} waiting
        </Badge>
      } />

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Queue is empty"
          description="Nothing is waiting on you right now — new submissions appear here the moment they're filed."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((s) => {
            const entries = Object.entries((s.payload ?? {}) as Record<string, unknown>);
            return (
              <Card key={s.id} className="flex flex-col gap-0 overflow-hidden py-0">
                <CardHeader className="gap-1.5 border-b px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">{s.template.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {s.template.audienceRole.toLowerCase()}
                      </Badge>
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.submittedBy.name}
                    {s.submittedBy.registrationNo ? ` · ${s.submittedBy.registrationNo}` : ""} · {fmt(s.createdAt)} ·{" "}
                    <span className="font-medium text-warning">waiting {waiting(s.createdAt)}</span>
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <dl className="grid gap-2 text-sm">
                    {entries.map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[minmax(90px,140px)_1fr] gap-2">
                        <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {prettify(key)}
                        </dt>
                        <dd className="break-words">{renderValue(value)}</dd>
                      </div>
                    ))}
                  </dl>

                  {s.attachmentName ? (
                    <a
                      href={`/api/submissions/${s.id}/attachment`}
                      className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/40"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {s.attachmentName}
                    </a>
                  ) : null}

                  <form action={decideAction} className="mt-auto space-y-3 border-t pt-4">
                    <input type="hidden" name="id" value={s.id} />
                    <Textarea
                      name="comment"
                      rows={2}
                      placeholder={`Optional note for ${s.submittedBy.name.split(" ")[0]} — sent with the decision`}
                      className="min-h-0"
                    />
                    <ReviewActions status={s.status} />
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
