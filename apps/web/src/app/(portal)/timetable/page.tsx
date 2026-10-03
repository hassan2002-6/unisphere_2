import { AlertTriangle, CalendarDays } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getScheduleData, formatDay, minToLabel } from "@/server/services/schedule";
import { TimetableGrid } from "@/components/timetable-grid";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const user = await requireUser();

  let data: Awaited<ReturnType<typeof getScheduleData>> | null = null;
  let dbError = false;
  try {
    data = await getScheduleData(user);
  } catch (error) {
    console.error("timetable load failed:", error);
    dbError = true;
  }

  const weekScope =
    user.role === "STUDENT"
      ? "Your section's weekly schedule (Monday–Saturday)."
      : user.role === "FACULTY"
        ? "The classes you teach this semester."
        : "Every scheduled class this semester.";

  if (!data) {
    return (
      <>
        <PageHeader icon={CalendarDays} title="Timetable" description={weekScope} />
        <Alert variant="destructive">
          <AlertTitle>Timetable unavailable</AlertTitle>
          <AlertDescription>
            {dbError
              ? "The database did not answer — check the Neon project and DATABASE_URL."
              : "No data returned."}
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const { classes, clashes } = data;
  const canFixClashes = user.role === "COORDINATOR" || user.role === "FYP_HEAD";

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Timetable"
        description={weekScope}
        actions={
          clashes.length > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {clashes.length} clash{clashes.length === 1 ? "" : "es"} flagged
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              No clashes detected
            </span>
          )
        }
      />

      {clashes.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>
            {clashes.length} scheduling conflict{clashes.length === 1 ? "" : "s"} detected
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1">
              {clashes.slice(0, 4).map((c, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{c.detail ?? `${c.kind} clash`}</span>
                  {c.day ? ` — ${formatDay(c.day)} ${minToLabel(c.startMin)}–${minToLabel(c.endMin)}` : ""}
                  {c.date ? ` — ${c.date}` : ""}
                </li>
              ))}
              {clashes.length > 4 ? <li>…and {clashes.length - 4} more.</li> : null}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {classes.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes scheduled"
          description="Nothing is scheduled for your scope yet. Once the coordinator publishes the timetable, it appears here automatically."
        />
      ) : (
        <TimetableGrid classes={classes} clashes={clashes} />
      )}

      {canFixClashes && clashes.length > 0 ? (
        <Card className="border-destructive/30">
          <CardHeader className="py-3.5">
            <CardTitle className="text-sm">Working the resolution desk?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            Acknowledge and resolve each clash — students and faculty see the flag clear immediately.
            <Button size="sm" asChild>
              <Link href="/coordinator/clashes">Open clash monitor</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
