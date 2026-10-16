import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Award, BookOpen, CalendarCheck, GraduationCap, SquarePen, UserRound } from "lucide-react";
import { requireUser, requireCapability } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getStudentAcademicProfile, recordProfileView } from "@/server/services/students";
import {
  CORRECTION_FIELD_WHITELIST,
  fieldLabel,
  listMyCorrectionRequests,
  type CorrectionRequestListItem,
} from "@/server/services/corrections";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { CorrectionRequestForm, type CorrectionFieldOption } from "@/components/correction-request-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

/** Current value of one whitelisted StudentProfile field ("" when unset). */
function profileFieldValue(
  field: string,
  profile: { program: string; semester: number | null; batch: string | null; section: string | null } | null,
): string {
  if (!profile) return "";
  if (field === "program") return profile.program;
  if (field === "semester") return profile.semester === null ? "" : String(profile.semester);
  if (field === "batch") return profile.batch ?? "";
  if (field === "section") return profile.section ?? "";
  return "";
}

/** Permitted academic profile — faculty view (spec §7). */
export default async function FacultyStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  await requireCapability("students.search");
  const { id } = await params;

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

  const canRequestCorrection = can(viewer.role, "corrections.request");
  let myCorrections: CorrectionRequestListItem[] = [];
  if (canRequestCorrection) {
    try {
      myCorrections = await listMyCorrectionRequests(viewer, { recordId: student.id, take: 5 });
    } catch (error) {
      console.error("correction requests load failed:", error);
    }
  }

  // Field options come straight from the service whitelist — the current value
  // shown here is display-only; the service re-captures it when storing.
  const correctionOptions: CorrectionFieldOption[] = [
    ...CORRECTION_FIELD_WHITELIST.StudentProfile.map((field) => ({
      target: `StudentProfile:${field}`,
      label: fieldLabel(field),
      currentValue: profileFieldValue(field, sp),
    })),
    ...CORRECTION_FIELD_WHITELIST.User.map((field) => ({
      target: `User:${field}`,
      label: fieldLabel(field),
      currentValue: field === "name" ? student.name : (student.registrationNo ?? ""),
    })),
  ];

  return (
    <>
      <PageHeader
        icon={UserRound}
        breadcrumbs={[{ label: "Students", href: "/faculty/students" }, { label: student.name }]}
        title={student.name}
        description="Permitted academic profile — identity, per-course attendance, current assessments and published results."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/faculty/students">
              <ArrowLeft className="h-4 w-4" />
              Back to search
            </Link>
          </Button>
        }
      />

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

      {canRequestCorrection ? (
        <Card>
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <SquarePen className="h-4 w-4 text-muted-foreground" />
              Data corrections
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Faculty cannot edit student records directly. Pick a field, enter the correct value and give a reason —
              an administrator reviews the request, and you are notified of the decision either way.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pt-4">
            {sp ? (
              <CorrectionRequestForm recordId={student.id} options={correctionOptions} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This student has no academic profile yet — the administration office must create it before corrections
                can be requested.
              </p>
            )}

            {myCorrections.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Your recent requests for this student
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Field</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myCorrections.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.fieldLabel}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.oldValue ?? "—"} <span className="text-muted-foreground">→</span> {r.newValue}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-muted-foreground">
                            {r.createdAt.toLocaleDateString("en-GB", MEMBER_SINCE_FMT)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.status === "PENDING"
                              ? "Awaiting review"
                              : (r.decisionNote ?? (r.handledByName ? `Decided by ${r.handledByName}` : "—"))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
