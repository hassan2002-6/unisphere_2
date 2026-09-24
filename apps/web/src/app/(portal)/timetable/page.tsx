import { requireUser } from "@/lib/auth";
import { getScheduleData, formatDay, minToLabel } from "@/server/services/schedule";
import { TimetableGrid } from "@/components/timetable-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const user = await requireUser();

  let data: Awaited<ReturnType<typeof getScheduleData>> | null = null;
  let dbError = false;
  try {
    data = await getScheduleData(user);
  } catch {
    dbError = true;
  }

  if (!data) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timetable unavailable</CardTitle>
            <CardDescription>
              {dbError ? "The database did not answer — check DATABASE_URL and the Neon project." : "No data."}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { classes, clashes } = data;

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "STUDENT"
              ? "Your section's weekly schedule (Mon–Sat)."
              : user.role === "FACULTY"
                ? "Classes you teach this semester."
                : "All scheduled classes this semester."}
          </p>
        </div>
        {clashes.length > 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {clashes.length} clash{clashes.length === 1 ? "" : "es"} flagged
          </div>
        ) : null}
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No classes scheduled</CardTitle>
            <CardDescription>
              Nothing is scheduled for your scope yet — the seed creates a full demo timetable.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <TimetableGrid classes={classes} clashes={clashes} />
      )}

      {clashes.length > 0 ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Clash details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {clashes.map((c, i) => (
              <p key={i} className="text-muted-foreground">
                <span className="font-medium text-foreground">{c.detail}</span>
                {c.day ? ` · ${formatDay(c.day)} ${minToLabel(c.startMin)}–${minToLabel(c.endMin)}` : ""}
                {c.date ? ` · ${c.date}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
