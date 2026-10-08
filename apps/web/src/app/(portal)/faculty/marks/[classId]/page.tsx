import Link from "next/link";
import { ArrowLeft, GraduationCap, ListPlus, Send } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getClassMarks } from "@/server/services/marks";
import { prisma } from "@/lib/db";
import type { AssessmentKind } from "@unisphere/db";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAssessmentAction, enterScoresAction, publishResultsAction } from "../actions";

export const dynamic = "force-dynamic";

const ASSESSMENT_KINDS: AssessmentKind[] = ["QUIZ", "ASSIGNMENT", "MIDTERM", "FINAL", "PROJECT"];
const KIND_LABELS: Record<AssessmentKind, string> = {
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  MIDTERM: "Midterm",
  FINAL: "Final",
  PROJECT: "Project",
};

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function gradeTone(grade: string): string {
  if (grade === "F") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (grade.startsWith("A")) return "border-success/25 bg-success/10 text-success";
  if (grade.startsWith("B")) return "border-info/25 bg-info/10 text-info";
  return "border-warning/30 bg-warning/10 text-warning";
}

type PublishedResult = {
  studentId: string;
  totalMarks: number | null;
  grade: string | null;
  gradePoints: number | null;
};

export default async function FacultyClassMarksPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireCapability("marks.manage");
  const { classId } = await params;
  const { saved, error } = await searchParams;

  let data: Awaited<ReturnType<typeof getClassMarks>> | null = null;
  let results: PublishedResult[] = [];
  let loadError: string | null = null;
  try {
    data = await getClassMarks(user, classId);
    results = await prisma.courseResult.findMany({
      where: { classId, published: true },
      select: { studentId: true, totalMarks: true, grade: true, gradePoints: true },
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load this class.";
  }

  if (!data) {
    return (
      <>
        <PageHeader
          icon={GraduationCap}
          breadcrumbs={[{ label: "Marks Entry", href: "/faculty/marks" }, { label: "Class marks" }]}
          title="Class marks"
        />
        <Alert variant="destructive">
          <AlertTitle>Can&apos;t open this class</AlertTitle>
          <AlertDescription>{loadError ?? "The class could not be loaded."}</AlertDescription>
        </Alert>
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/faculty/marks">
              <ArrowLeft className="h-4 w-4" />
              Back to marks entry
            </Link>
          </Button>
        </div>
      </>
    );
  }

  const { cls, assessments, roster } = data;
  const rosterById = new Map(roster.map((s) => [s.studentId, s]));

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        breadcrumbs={[{ label: "Marks Entry", href: "/faculty/marks" }, { label: `${cls.courseCode} · ${cls.section}` }]}
        title={`${cls.courseCode} — marks`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{cls.title}</span>
            <span aria-hidden>·</span>
            <span>Section {cls.section}</span>
            <span aria-hidden>·</span>
            <span>
              {roster.length} student{roster.length === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>
              {assessments.length} assessment{assessments.length === 1 ? "" : "s"}
            </span>
          </span>
        }
        actions={
          assessments.length > 0 ? (
            <ConfirmAction
              action={publishResultsAction}
              values={{ classId: cls.id }}
              title={
                results.length > 0
                  ? `Re-publish results for ${cls.courseCode}?`
                  : `Publish results for ${cls.courseCode}?`
              }
              description="Each student's total is computed from the assessments, mapped to the letter scale and shown on their Marks & GPA page. Students are notified — re-publishing updates the same results."
              confirmLabel={results.length > 0 ? "Re-publish results" : "Publish results"}
              trigger={
                <Button size="sm">
                  <Send className="h-4 w-4" />
                  {results.length > 0 ? "Re-publish results" : "Publish results"}
                </Button>
              }
            />
          ) : null
        }
      />

      {saved === "published" ? (
        <Alert variant="success">
          <AlertTitle>Results published</AlertTitle>
          <AlertDescription>
            Every enrolled student has been notified and can see the grade under Marks &amp; GPA.
          </AlertDescription>
        </Alert>
      ) : null}
      {saved === "assessment" ? (
        <Alert variant="success">
          <AlertTitle>Assessment added</AlertTitle>
          <AlertDescription>It now appears below — enter the marks for the class.</AlertDescription>
        </Alert>
      ) : null}
      {saved && saved !== "published" && saved !== "assessment" ? (
        <Alert variant="success">
          <AlertTitle>Marks saved</AlertTitle>
          <AlertDescription>The entered marks are stored against each student in the class.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {assessments.length === 0 ? (
        <Alert variant="warning">
          <AlertTitle>No assessments yet</AlertTitle>
          <AlertDescription>
            Add a quiz, assignment, midterm, final or project below — then enter the marks for the class.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => {
            const scored = roster.map((s) => s.scores[a.id]).filter((m): m is number => typeof m === "number");
            const entered = scored.length;
            const avg = entered ? Math.round((scored.reduce((n, m) => n + m, 0) / entered) * 10) / 10 : null;
            return (
              <Card key={a.id} className="gap-0 overflow-hidden py-0">
                <CardHeader className="border-b px-5 py-4">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <StatusBadge status={a.kind} />
                    {a.title}
                  </CardTitle>
                  <CardDescription>
                    Out of {a.maxMarks}
                    {a.date ? ` · ${fmtDate(a.date)}` : ""} · {entered} of {roster.length} entered
                    {avg !== null ? ` · class average ${avg}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {roster.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        compact
                        icon={GraduationCap}
                        title="No students enrolled"
                        description="Enrolled students appear here for scoring."
                      />
                    </div>
                  ) : (
                    <form action={enterScoresAction}>
                      <input type="hidden" name="classId" value={cls.id} />
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="pl-5">Student</TableHead>
                            <TableHead>Marks (out of {a.maxMarks})</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {roster.map((st) => (
                            <TableRow key={st.studentId}>
                              <TableCell className="pl-5">
                                <span className="font-medium">{st.name}</span>
                                <p className="font-mono text-xs text-muted-foreground">{st.registrationNo ?? "—"}</p>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  name={`score[${st.studentId}]`}
                                  defaultValue={st.scores[a.id] ?? ""}
                                  min={0}
                                  max={a.maxMarks}
                                  step={1}
                                  inputMode="numeric"
                                  aria-label={`Marks for ${st.name} out of ${a.maxMarks}`}
                                  className="h-8 w-28 tabular-nums"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
                        <p className="text-xs text-muted-foreground">
                          Blank a box to clear that student&apos;s mark. Values are clamped to 0–{a.maxMarks}.
                        </p>
                        <SubmitButton size="sm" pendingLabel="Saving…">
                          Save marks
                        </SubmitButton>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ListPlus className="h-4 w-4 text-muted-foreground" />
            Add assessment
          </CardTitle>
          <CardDescription>Each assessment becomes a column of marks for the whole class.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAssessmentAction} className="grid max-w-2xl gap-4">
            <input type="hidden" name="classId" value={cls.id} />
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div className="grid gap-1.5">
                <Label htmlFor="kind">
                  Kind <span className="text-destructive">*</span>
                </Label>
                <Select name="kind" defaultValue="QUIZ">
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue placeholder="Pick a kind" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSESSMENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input id="title" name="title" required maxLength={200} placeholder="Quiz 3 — Deadlocks & Memory" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[10rem_10rem]">
              <div className="grid gap-1.5">
                <Label htmlFor="maxMarks">
                  Max marks <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="maxMarks"
                  name="maxMarks"
                  type="number"
                  required
                  min={1}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                  placeholder="20"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" />
              </div>
            </div>
            <SubmitButton size="sm" className="w-fit" pendingLabel="Adding…">
              <ListPlus className="h-4 w-4" />
              Add assessment
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">Published results</CardTitle>
            <CardDescription>
              Live on Marks &amp; GPA — {results.length} of {roster.length} student{roster.length === 1 ? "" : "s"} published.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Student</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="pr-5">Grade points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const st = rosterById.get(r.studentId);
                  return (
                    <TableRow key={r.studentId}>
                      <TableCell className="pl-5">
                        <span className="font-medium">{st?.name ?? "Former student"}</span>
                        <p className="font-mono text-xs text-muted-foreground">{st?.registrationNo ?? "—"}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {r.totalMarks !== null ? `${r.totalMarks}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {r.grade ? (
                          <Badge variant="outline" className={gradeTone(r.grade)}>
                            {r.grade}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 font-mono text-xs tabular-nums">
                        {r.gradePoints !== null ? r.gradePoints.toFixed(2) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
