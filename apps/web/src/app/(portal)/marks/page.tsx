import { redirect } from "next/navigation";
import { Award, BookOpen, GraduationCap, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStudentMarks } from "@/server/services/marks";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fmt = (n: number | null, suffix = "") => (n === null ? "—" : `${n}${suffix}`);

export default async function MarksPage() {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard");

  const data = await getStudentMarks(user);
  const graded = data.results.filter((r) => r.grade);
  const best = [...graded].sort((a, b) => (b.gradePoints ?? 0) - (a.gradePoints ?? 0))[0];

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="Marks & GPA"
        description="Assessment marks for the running semester plus your published results, semester GPA and CGPA."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CGPA"
          value={data.cgpa ?? "—"}
          hint={data.totalCredits ? `${data.totalCredits} graded credit hours` : "No published results yet"}
          icon={Award}
          tone="primary"
        />
        <StatCard
          label="Semester GPA"
          value={data.semesterGpa ?? "—"}
          hint={data.semesterGpa === null ? `Projected ${data.projectedGpa ?? "—"} from assessments` : "Published this semester"}
          icon={TrendingUp}
          tone="info"
        />
        <StatCard
          label="Courses in progress"
          value={data.current.length}
          hint={data.current.length ? data.current.map((c) => c.courseCode).join(", ") : "None registered"}
          icon={BookOpen}
          tone="default"
        />
        <StatCard
          label="Best result"
          value={best ? best.grade ?? "—" : "—"}
          hint={best ? `${best.courseCode} · ${best.totalMarks}%` : "Graded results appear here"}
          icon={Award}
          tone="success"
        />
      </section>

      <Alert>
        <AlertTitle>How grades are computed</AlertTitle>
        <AlertDescription>
          Assessment marks (quiz, assignment, midterm) are entered by your course faculty. When a course is
          finalised, its result is <span className="font-medium">published</span> and feeds the GPA/CGPA using the
          letter scale A+ 4.00 · A 3.75 · B+ 3.50 · B 3.00 · C+ 2.50 · C 2.00 · D 1.00.
        </AlertDescription>
      </Alert>

      {data.current.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No registered courses"
          description="Once you are enrolled in this semester's courses, your assessments and marks will appear here."
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {data.current.map((c) => (
            <Card key={c.classId} className="gap-0 overflow-hidden py-0">
              <CardHeader className="flex-row items-center justify-between gap-2 border-b px-5 py-3.5">
                <CardTitle className="flex flex-col gap-0.5 text-sm font-semibold">
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{c.courseCode}</span> {c.title}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Section {c.section} · {c.credits} credit hours
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {c.published?.grade ? <StatusBadge status={c.published.grade} /> : null}
                  {c.projectedGrade ? (
                    <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                      {c.pct}% → {c.projectedGrade}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {c.assessments.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">
                    No assessments have been created for this course yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="pl-5">Assessment</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead className="pr-5">Class average</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.assessments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="pl-5">
                            <StatusBadge status={a.kind} className="mr-2" />
                            {a.title}
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {a.marks === null ? (
                              <span className="text-muted-foreground">not entered</span>
                            ) : (
                              `${a.marks} / ${a.maxMarks}`
                            )}
                          </TableCell>
                          <TableCell className="pr-5 font-mono text-xs tabular-nums text-muted-foreground">
                            {a.classAvg === null ? "—" : `${a.classAvg} / ${a.maxMarks}`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="text-sm font-semibold">Published results</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {graded.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              No results are published yet — they appear here as each semester is finalised.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="pr-5">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {graded.map((r) => (
                  <TableRow key={r.classId}>
                    <TableCell className="pl-5">
                      <span className="font-mono text-xs text-muted-foreground">{r.courseCode}</span>
                      <span className="ml-2">{r.title}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.semester}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{fmt(r.totalMarks, "%")}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.grade ?? ""} />
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.gradePoints?.toFixed(2)}</TableCell>
                    <TableCell className="pr-5 font-mono text-xs tabular-nums">{r.credits}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
