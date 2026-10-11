import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Award, BookOpen, CalendarCheck, GraduationCap, SquarePen, UserRound } from "lucide-react";
import { requireUser, requireCapability } from "@/lib/auth";
import { getStudentAcademicProfile, recordProfileView } from "@/server/services/students";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { correctStudentRecordAction } from "../actions";

export const dynamic = "force-dynamic";

const MEMBER_SINCE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Karachi",
};

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

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-3.5 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm break-words">{value}</span>
    </div>
  );
}

/** Permitted academic profile — coordinator view (spec §7). */
export default async function CoordinatorStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const viewer = await requireUser();
  await requireCapability("students.search");
  const { id } = await params;
  const { saved, error } = await searchParams;

  let profile: Awaited<ReturnType<typeof getStudentAcademicProfile>> = null;
  try {
    profile = await getStudentAcademicProfile(viewer, id);
  } catch (error) {
    console.error("student profile load failed:", error);
    profile = null;
  }
  if (!profile) notFound();

  // Spec §18 — important actions are audited. Fire-and-forget: never blocks the render.
  recordProfileView(viewer, profile.student.id, profile.student.name).catch(() => {});

  const { student, courses, results, cgpa } = profile;
  const sp = student.profile;
  const programLabel = sp ? sp.program : "—";
  const semesterLabel = sp && sp.semester !== null ? `Semester ${sp.semester}` : "—";
  const sectionLabel = sp && sp.section ? `Section ${sp.section}` : "—";
  const lowAttendance = courses.filter((c) => c.attendancePct !== null && c.attendancePct < 75);

  return (
    <>
      <PageHeader
        icon={UserRound}
        breadcrumbs={[{ label: "Students", href: "/coordinator/students" }, { label: student.name }]}
        title={student.name}
        description="Permitted academic profile — identity, per-course attendance, current assessments and published results."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/coordinator/students">
              <ArrowLeft className="h-4 w-4" />
              Back to search
            </Link>
          </Button>
        }
      />

      {saved ? (
        <Alert variant="success">
          <AlertTitle>Record updated</AlertTitle>
          <AlertDescription>{saved}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="CGPA"
          value={cgpa?.toFixed(2) ?? "—"}
          hint={`${results.length} published result${results.length === 1 ? "" : "s"}`}
          icon={Award}
          tone="primary"
        />
        <StatCard
          label="Active courses"
          value={courses.length}
          hint="Attendance and assessments tracked below"
          icon={BookOpen}
          tone="info"
        />
        <StatCard
          label="Below 75% attendance"
          value={lowAttendance.length}
          hint={lowAttendance.length ? lowAttendance.map((c) => c.courseCode).join(", ") : "All courses on track"}
          icon={CalendarCheck}
          tone={lowAttendance.length ? "danger" : "success"}
        />
      </section>

      <Card>
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Registration no" value={student.registrationNo ?? "—"} />
          <Field label="Program" value={programLabel} />
          <Field label="Semester" value={semesterLabel} />
          <Field label="Section" value={sectionLabel} />
          <Field label="Department" value={student.department ?? "—"} />
          <Field label="Email" value={student.email} />
          <Field label="Member since" value={student.memberSince.toLocaleDateString("en-GB", MEMBER_SINCE_FMT)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <SquarePen className="h-4 w-4 text-muted-foreground" />
            Correct academic record
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Authorized corrections only — the student is notified and the change is recorded with your name and
            reason. The university ID itself is never editable here.
          </p>
        </CardHeader>
        <CardContent className="px-5 pt-4">
          <form action={correctStudentRecordAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="studentId" value={student.id} />
            <div className="flex flex-col gap-1">
              <label htmlFor="corr-program" className="text-[11px] text-muted-foreground">
                Programme
              </label>
              <Input id="corr-program" name="program" defaultValue={sp?.program ?? ""} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="corr-semester" className="text-[11px] text-muted-foreground">
                Semester
              </label>
              <Input
                id="corr-semester"
                name="semester"
                inputMode="numeric"
                defaultValue={sp?.semester ?? ""}
                placeholder="e.g. 7"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="corr-section" className="text-[11px] text-muted-foreground">
                Section
              </label>
              <Input id="corr-section" name="section" defaultValue={sp?.section ?? ""} placeholder="A" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="corr-batch" className="text-[11px] text-muted-foreground">
                Batch
              </label>
              <Input id="corr-batch" name="batch" defaultValue={sp?.batch ?? ""} placeholder="2022" />
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label htmlFor="corr-reason" className="text-[11px] text-muted-foreground">
                Reason for the correction
              </label>
              <Input id="corr-reason" name="reason" required placeholder="e.g. section change approved by the HOD" />
            </div>
            <SubmitButton pendingLabel="Saving…">Save correction</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No active courses"
          description="There are no running enrolments for this student yet — attendance and assessments appear once a course starts."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Active courses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Breakdown</TableHead>
                  <TableHead className="pr-5">Midterm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.classId}>
                    <TableCell className="pl-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{c.courseCode}</span>
                        <span>{c.title}</span>
                        {c.mine ? (
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                            Your course
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Semester {c.semester} · Section {c.section}
                      </p>
                    </TableCell>
                    <TableCell>{c.faculty}</TableCell>
                    <TableCell>
                      {c.attendancePct !== null ? (
                        <PctBar pct={c.attendancePct} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.attendanceCounts.present} present · {c.attendanceCounts.late} late · {c.attendanceCounts.absent} absent ·{" "}
                      {c.attendanceCounts.excused} excused
                    </TableCell>
                    <TableCell className="pr-5">
                      {c.midtermPct !== null ? (
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs tabular-nums">{c.midtermPct}%</span>
                          {c.midtermGrade ? (
                            <Badge variant="outline" className="border-border bg-muted/60 font-mono">
                              {c.midtermGrade}
                            </Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {results.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No published results yet"
          description="Grades appear here once the examination cell publishes results for completed courses."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                Published results
              </span>
              {cgpa !== null ? (
                <span className="font-mono text-xs font-normal text-muted-foreground">CGPA {cgpa.toFixed(2)}</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead className="pr-5">Grade points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={`${r.courseCode}-${r.semester}`}>
                    <TableCell className="pl-5">
                      <span className="font-mono text-xs text-muted-foreground">{r.courseCode}</span>
                      <span className="ml-2">{r.title}</span>
                    </TableCell>
                    <TableCell>{r.semester}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.credits}</TableCell>
                    <TableCell>
                      {r.grade ? (
                        <Badge variant="outline" className="border-border bg-muted/60 font-mono">
                          {r.grade}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.totalMarks ?? "—"}</TableCell>
                    <TableCell className="pr-5 font-mono text-xs tabular-nums">{r.gradePoints ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
