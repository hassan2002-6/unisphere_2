import { redirect } from "next/navigation";
import { CalendarCheck, TriangleAlert, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStudentAttendance } from "@/server/services/attendance";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

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

export default async function AttendancePage() {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard");

  const data = await getStudentAttendance(user);
  const low = data.courses.filter((c) => c.total > 0 && c.pct < 75);
  const best = [...data.courses].sort((a, b) => b.pct - a.pct)[0];

  return (
    <>
      <PageHeader
        icon={CalendarCheck}
        title="Attendance"
        description="Session-by-session attendance for your enrolled courses this semester. The university requires 75% per course."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall attendance"
          value={data.overall.total ? `${data.overall.pct}%` : "—"}
          hint={`${data.overall.total} sessions recorded`}
          icon={CalendarCheck}
          tone={data.overall.pct >= 85 ? "success" : data.overall.pct >= 75 ? "warning" : "danger"}
        />
        <StatCard
          label="Present / late"
          value={`${data.overall.present} / ${data.overall.late}`}
          hint={best ? `Best: ${best.courseCode} (${best.pct}%)` : "No sessions yet"}
          icon={CalendarCheck}
          tone="info"
        />
        <StatCard
          label="Absences"
          value={data.overall.absent}
          hint={data.overall.excused ? `${data.overall.excused} excused` : "None excused"}
          icon={UserX}
          tone={data.overall.absent > 6 ? "danger" : "default"}
        />
        <StatCard
          label="Courses below 75%"
          value={low.length}
          hint={low.length ? low.map((c) => c.courseCode).join(", ") : "All courses on track"}
          icon={TriangleAlert}
          tone={low.length ? "danger" : "success"}
        />
      </section>

      {low.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>
            Attendance below the 75% requirement in {low.length} course{low.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            {low.map((c) => `${c.courseCode} (${c.pct}%)`).join(" · ")} — attend upcoming sessions or apply for
            medical leave through the Forms Center if there is a valid reason.
          </AlertDescription>
        </Alert>
      ) : null}

      {data.courses.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No attendance yet"
          description="Attendance appears here once your courses begin and faculty mark the first sessions."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">By course</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Excused</TableHead>
                  <TableHead className="pr-5">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.courses.map((c) => (
                  <TableRow key={c.classId}>
                    <TableCell className="pl-5">
                      <span className="font-mono text-xs text-muted-foreground">{c.courseCode}</span>
                      <span className="ml-2">{c.title}</span>
                      <p className="text-xs text-muted-foreground">Section {c.section}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.total}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.present}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.late}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.absent}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.excused}</TableCell>
                    <TableCell className="pr-5">
                      {c.total === 0 ? <span className="text-xs text-muted-foreground">—</span> : <PctBar pct={c.pct} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.recent.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="pr-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5 font-medium">{fmtDate(r.date)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{r.courseCode}</span>
                      <span className="ml-2">{r.title}</span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
