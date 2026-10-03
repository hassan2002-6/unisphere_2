import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, MessageSquareText, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMySubmission } from "@/server/services/forms";
import { formFieldsSchema } from "@/lib/validation";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withdrawAction } from "../../forms/actions";

export const dynamic = "force-dynamic";

function renderValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let sub: Awaited<ReturnType<typeof getMySubmission>> | null = null;
  try {
    sub = await getMySubmission(user, id);
  } catch {
    sub = null;
  }
  if (!sub) notFound();

  const fields = formFieldsSchema.safeParse(sub.template.fields);
  const payload = (sub.payload ?? {}) as Record<string, unknown>;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "My Submissions", href: "/submissions" }, { label: sub.template.title }]}
        title={sub.template.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={sub.status} />
            <span>Submitted {fmt(sub.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>Routed to {sub.template.recipientLabel}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/submissions">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {sub.status === "SUBMITTED" ? (
              <ConfirmAction
                action={withdrawAction}
                values={{ id: sub.id }}
                title="Withdraw this submission?"
                description="The reviewer will no longer see it in the queue. You can submit a fresh request any time."
                confirmLabel="Withdraw"
                variant="destructive"
                trigger={
                  <Button variant="destructive" size="sm">
                    <Undo2 className="h-4 w-4" />
                    Withdraw
                  </Button>
                }
              />
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Submission content
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields.success ? (
              fields.data.map((f) => (
                <div key={f.name} className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-3.5 py-2.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </span>
                  <span className="text-sm break-words">{renderValue(payload[f.name])}</span>
                </div>
              ))
            ) : (
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sub.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <ol className="relative space-y-5 border-l border-border pl-5">
                {sub.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={e.toStatus} />
                      <span className="text-xs text-muted-foreground">{fmt(e.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">{e.actor?.name ?? "System"}</span>
                      {e.comment ? <span className="text-muted-foreground"> — {e.comment}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
