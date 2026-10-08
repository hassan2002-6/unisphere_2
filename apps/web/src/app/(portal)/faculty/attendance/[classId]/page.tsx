import Link from "next/link";
import { ArrowLeft, CalendarCheck, Save } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { ATTENDANCE_STATUSES, getClassSession, parseDateOnly, toDateOnly } from "@/server/services/attendance";
import type { AttendanceStatus } from "@unisphere/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { markAttendanceAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

/** Accept "YYYY-MM-DD" only when it round-trips; otherwise fall back to today. */
function normalizeDateISO(raw: string | undefined): string {
  const today = toDateOnly(new Date());
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  try {
    return toDateOnly(parseDateOnly(raw)) === raw ? raw : today;
  } catch {
    return today;
  }
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });

export default async function FacultySessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string; saved?: string; error?: string }>;
}) {
  const user = await requireCapability("attendance.manage");
  const { classId } = await params;
  const { date: rawDate, saved, error } = await searchParams;
  const dateISO = normalizeDateISO(rawDate);

  let session: Awaited<ReturnType<typeof getClassSession>> | null = null;
  let loadError: string | null = null;
  try {
    session = await getClassSession(user, classId, dateISO);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load this class.";
  }

  if (!session) {
    return (
      <>
        <PageHeader
          icon={CalendarCheck}
          breadcrumbs={[{ label: "Attendance", href: "/faculty/attendance" }, { label: "Session register" }]}
          title="Session register"
        />
        <Alert variant="destructive">
          <AlertTitle>Can&apos;t open this class</AlertTitle>
          <AlertDescription>{loadError ?? "The class could not be loaded."}</AlertDescription>
        </Alert>
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/faculty/attendance">
              <ArrowLeft className="h-4 w-4" />
              Back to attendance
            </Link>
          </Button>
        </div>
      </>
    );
  }

  const { cls, date, roster, marked } = session;
  const markedCount = roster.filter((s) => s.status !== null).length;

  return (
    <>
      <PageHeader
        icon={CalendarCheck}
        breadcrumbs={[{ label: "Attendance", href: "/faculty/attendance" }, { label: `${cls.courseCode} · ${cls.section}` }]}
        title={`${cls.courseCode} — session register`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{cls.title}</span>
            <span aria-hidden>·</span>
            <span>Section {cls.section}</span>
            <span aria-hidden>·</span>
            <span>{fmtDate(date)}</span>
            <Badge variant={marked ? "secondary" : "outline"}>{marked ? "Register saved" : "Not marked yet"}</Badge>
          </span>
        }
      />

      {saved ? (
        <Alert variant="success">
          <AlertTitle>Attendance saved</AlertTitle>
          <AlertDescription>
            The register for {fmtDate(date)} is up to date. You can keep editing and save again.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save the register</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold">Session date</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={dateISO} className="w-44" />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Load session
            </Button>
            <p className="text-xs text-muted-foreground">
              Pick any date — past registers load for review or correction.
            </p>
          </form>
        </CardContent>
      </Card>

      {roster.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No students enrolled"
          description="Once students are enrolled in this class they appear here for marking."
        />
      ) : (
        <form action={markAttendanceAction} className="flex flex-col gap-4">
          <input type="hidden" name="classId" value={cls.id} />
          <input type="hidden" name="date" value={dateISO} />
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
              <CardTitle className="text-sm font-semibold">Roster ({roster.length} students)</CardTitle>
              <span className="text-xs text-muted-foreground">
                {marked
                  ? `${markedCount} of ${roster.length} marked — saving replaces this date's register.`
                  : "Choose a status for every student, then save."}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Student</TableHead>
                    {ATTENDANCE_STATUSES.map((status) => (
                      <TableHead key={status} className="text-center">
                        {STATUS_LABELS[status]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="pl-5">
                        <span className="font-medium">{student.name}</span>
                        <p className="font-mono text-xs text-muted-foreground">{student.registrationNo ?? "—"}</p>
                      </TableCell>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <TableCell key={status} className="text-center">
                          <input
                            type="radio"
                            name={`status[${student.studentId}]`}
                            value={status}
                            defaultChecked={student.status === status}
                            required={student.status === null}
                            aria-label={`${student.name} — ${STATUS_LABELS[status]}`}
                            className="size-4 accent-primary"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/faculty/attendance">
                <ArrowLeft className="h-4 w-4" />
                Back to classes
              </Link>
            </Button>
            <SubmitButton pendingLabel="Saving…">
              <Save className="h-4 w-4" />
              Save register
            </SubmitButton>
          </div>
        </form>
      )}
    </>
  );
}
