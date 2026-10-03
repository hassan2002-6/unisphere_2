import { CircleCheck, ShieldAlert } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getClashReport, minToLabel, formatDay } from "@/server/services/schedule";
import { ClashBadge } from "@/components/clash-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { resolveClash } from "./actions";

export const dynamic = "force-dynamic";

function clashWhen(c: { day?: string; date?: string; startMin: number; endMin: number }): string {
  const time = `${minToLabel(c.startMin)}–${minToLabel(c.endMin)}`;
  if (c.date) return `${c.date} · ${time}`;
  if (c.day) return `${formatDay(c.day)} · ${time}`;
  return time;
}

export default async function ClashMonitorPage() {
  await requireCapability("clashes.view");

  let report: Awaited<ReturnType<typeof getClashReport>> | null = null;
  try {
    report = await getClashReport();
  } catch {
    report = null;
  }

  if (!report) {
    return (
      <>
        <PageHeader
          icon={ShieldAlert}
          title="Clash Monitor"
          description="Room, lab, faculty, section and exam clashes across the whole timetable — computed live."
        />
        <Alert variant="destructive">
          <AlertTitle>Clash monitor unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const { active, resolved } = report;

  return (
    <>
      <PageHeader
        icon={ShieldAlert}
        title="Clash Monitor"
        description="Room, lab, faculty, section and exam clashes across the whole timetable — computed live."
      />

      <section aria-label="Clash summary" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Active clashes"
          value={active.length}
          hint={active.length > 0 ? "Waiting to be acknowledged" : "Timetable is clean"}
          icon={ShieldAlert}
          tone={active.length > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Resolved clashes"
          value={resolved.length}
          hint={resolved.length > 0 ? "Logged by the timetable office" : "No resolutions logged yet"}
          icon={CircleCheck}
          tone={resolved.length > 0 ? "success" : "default"}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Active clashes</h2>
        {active.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="No unresolved clashes"
            description="The timetable is clean. 🎉 New clashes appear here the moment the schedule changes."
            compact
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <ul className="divide-y">
                {active.map((c) => (
                  <li key={c.key} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ClashBadge kind={c.kind} />
                        <span className="text-sm font-medium">{c.detail}</span>
                        <span className="text-xs text-muted-foreground">{clashWhen(c)}</span>
                      </div>
                      <ConfirmAction
                        action={resolveClash}
                        values={{ key: c.key }}
                        title="Mark this clash as resolved?"
                        description="It leaves the active queue and is logged for the timetable office."
                        confirmLabel="Mark resolved"
                        reason={{ name: "note", label: "Resolution note", placeholder: "e.g. moved CS-305 to Tuesday 10:00", required: false }}
                        trigger={
                          <Button variant="secondary" size="sm">
                            Mark resolved
                          </Button>
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.a.label} <span className="mx-1">↔</span> {c.b.label}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {resolved.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Resolved</h2>
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <ul className="divide-y">
                {resolved.map(({ clash, note, resolvedBy }) => (
                  <li key={clash.key} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClashBadge kind={clash.kind} />
                      <span className="text-sm font-medium line-through">{clash.detail}</span>
                      <span className="text-xs text-muted-foreground">{clashWhen(clash)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clash.a.label} ↔ {clash.b.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Resolved by {resolvedBy}
                      {note ? `: ${note}` : " (no note)"}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}
