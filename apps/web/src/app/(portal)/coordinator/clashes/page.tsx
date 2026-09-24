import { requireCapability } from "@/lib/auth";
import { getClashReport, minToLabel, formatDay } from "@/server/services/schedule";
import { ClashBadge } from "@/components/clash-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clash monitor unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { active, resolved } = report;

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clash Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Room, lab, faculty, section and exam clashes across the whole timetable — computed live.
        </p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">
            Active clashes {active.length > 0 ? `(${active.length})` : ""}
          </CardTitle>
          {active.length === 0 ? (
            <CardDescription>No unresolved clashes — the timetable is clean. 🎉</CardDescription>
          ) : (
            <CardDescription>
              Mark a clash as resolved (with a note) once the timetable office has been informed or the
              schedule adjusted.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {active.map((c) => (
            <div key={c.key} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ClashBadge kind={c.kind} />
                <span className="text-sm font-medium">{c.detail}</span>
                <span className="text-xs text-muted-foreground">{clashWhen(c)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.a.label} <span className="mx-1">↔</span> {c.b.label}
              </p>
              <form action={resolveClash} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="key" value={c.key} />
                <Input
                  name="note"
                  placeholder="Resolution note (e.g. moved CS-305 to Tuesday 10:00)"
                  className="h-8 max-w-md text-sm"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Mark resolved
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>

      {resolved.length > 0 ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Resolved ({resolved.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resolved.map(({ clash, note, resolvedBy }) => (
              <div key={clash.key} className="rounded-md border border-dashed p-3 opacity-80">
                <div className="flex flex-wrap items-center gap-2">
                  <ClashBadge kind={clash.kind} />
                  <span className="text-sm font-medium line-through">{clash.detail}</span>
                  <span className="text-xs text-muted-foreground">{clashWhen(clash)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {clash.a.label} ↔ {clash.b.label}
                </p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  Resolved by {resolvedBy}
                  {note ? `: ${note}` : " (no note)"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
