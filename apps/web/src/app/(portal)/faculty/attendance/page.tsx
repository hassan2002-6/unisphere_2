import Link from "next/link";
import { CalendarCheck, ClipboardCheck, TriangleAlert, Users } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getFacultyAttendanceOverview, toDateOnly } from "@/server/services/attendance";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Attendance share bar — same visual language as the student attendance page. */
function PctBar({ pct }: { pct: number }) {
  const tone = pct >= 85 ? "bg-success" : pct >= 75 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums">{pct}%</span>
    </div>
  );
}

export default async function FacultyAttendancePage() {
  const user = await requireCapability("attendance.manage");

  let rows: Awaited<ReturnType<typeof getFacultyAttendanceOverview>> | null = null;
  try {
    rows = await getFacultyAttendanceOverview(user);
  } catch (error) {
    console.error("faculty attendance load failed:", error);
    rows = null;
  }

  if (!rows) {
    return (
      <>
        <PageHeader icon={CalendarCheck} title="Attendance" />
        <Alert variant="destructive">
          <AlertTitle>Attendance unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const totalStudents = rows.reduce((n, r) => n + r.students, 0);
  const totalSessions = rows.reduce((n, r) => n + r.sessions, 0);
  const withRecords = rows.filter((r) => r.sessions > 0);
  const avgPct = withRecords.length
    ? Math.round(withRecords.reduce((n, r) => n + r.pct, 0) / withRecords.length)
    : null;
  const pendingToday = rows.filter((r) => !r.lastMarked || toDateOnly(r.lastMarked) !== r.today);

  return (
    <>
      <PageHeader
        icon={CalendarCheck}
        title="Attendance"
        description="Your classes this semester — students, sessions held, attendance share and the last register date. Open a class to mark a session."
      />

      {rows.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Classes"
            value={rows.length}
            hint={`${totalStudents} student${totalStudents === 1 ? "" : "s"} enrolled`}
            icon={CalendarCheck}
            tone="primary"
          />
          <StatCard
            label="Sessions marked"
            value={totalSessions}
            hint="Across all your classes"
            icon={ClipboardCheck}
            tone="info"
          />
          <StatCard
            label="Attendance share"
            value={avgPct === null ? "—" : `${avgPct}%`}
            hint={withRecords.length ? "Average across classes with registers" : "No sessions recorded yet"}
            icon={Users}
            tone={avgPct === null ? "default" : avgPct >= 85 ? "success" : avgPct >= 75 ? "warning" : "danger"}
          />
          <StatCard
            label="Not marked today"
            value={pendingToday.length}
            hint={
              pendingToday.length
                ? pendingToday.map((r) => r.courseCode).slice(0, 3).join(", ")
                : "Every class up to date"
            }
            icon={TriangleAlert}
            tone={pendingToday.length ? "warning" : "success"}
          />
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No classes to mark"
          description="Classes appear here once the coordinator assigns them to you and students are enrolled."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Last marked</TableHead>
                  <TableHead className="pr-5 text-right">Register</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const href = `/faculty/attendance/${r.classId}?date=${r.today}`;
                  const markedToday = r.lastMarked ? toDateOnly(r.lastMarked) === r.today : false;
                  return (
                    <TableRow key={r.classId}>
                      <TableCell className="pl-5">
                        <Link href={href} className="font-mono text-xs text-muted-foreground hover:text-foreground">
                          {r.courseCode}
                        </Link>
                        <Link href={href} className="ml-2 font-medium hover:underline">
                          {r.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">Section {r.section}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">{r.students}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">{r.sessions}</TableCell>
                      <TableCell>
                        {r.sessions === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <PctBar pct={r.pct} />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">{r.lastMarked ? fmtDate(r.lastMarked) : "Never"}</span>
                          {markedToday ? (
                            <Badge variant="outline" className="border-success/25 bg-success/10 text-success">
                              Today
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button variant={markedToday ? "outline" : "default"} size="sm" asChild>
                          <Link href={href}>{markedToday ? "Review" : "Mark"}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
