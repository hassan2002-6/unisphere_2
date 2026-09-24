import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMySubmission } from "@/server/services/forms";
import { formFieldsSchema } from "@/lib/validation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { withdrawAction } from "../../forms/actions";

export const dynamic = "force-dynamic";

function renderValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

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
    <main className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sub.template.title}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={sub.status} />
            <span>
              submitted{" "}
              {sub.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        </div>
        {sub.status === "SUBMITTED" ? (
          <form action={withdrawAction}>
            <input type="hidden" name="id" value={sub.id} />
            <Button type="submit" variant="destructive" size="sm">
              Withdraw submission
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Submission content</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {fields.success ? (
            fields.data.map((f) => (
              <div key={f.name} className="grid gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</span>
                <span>{renderValue(payload[f.name])}</span>
              </div>
            ))
          ) : (
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Timeline</CardTitle>
          <CardDescription>Every state change is recorded — nothing silently moves.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sub.events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">
                <StatusBadge status={e.toStatus} />
              </div>
              <div>
                <p>
                  <span className="font-medium">{e.actor?.name ?? "System"}</span>
                  {e.comment ? <span className="text-muted-foreground"> — {e.comment}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <Separator />
          <p className="text-xs text-muted-foreground">Routed to: {sub.template.recipientLabel}</p>
        </CardContent>
      </Card>
    </main>
  );
}
