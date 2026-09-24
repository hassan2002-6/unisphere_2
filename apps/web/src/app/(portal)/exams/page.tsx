import { requireUser } from "@/lib/auth";
import { getScheduleData, minToLabel } from "@/server/services/schedule";
import { ClashBadge } from "@/components/clash-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClashKind } from "@/server/clash";

export const dynamic = "force-dynamic";

const EXAM_CLASH_KINDS: ClashKind[] = ["exam-vs-class", "exam-hall", "exam-cohort"];

export default async function ExamsPage() {
  const user = await requireUser();

  let data: Awaited<ReturnType<typeof getScheduleData>> | null = null;
  try {
    data = await getScheduleData(user);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exams unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const examRows = data.classes
    .flatMap((c) => c.exams.map((e) => ({ exam: e, cls: c })))
    .sort((a, b) => a.exam.date.getTime() - b.exam.date.getTime() || a.exam.startMin - b.exam.startMin);

  // Map exam id → clash kinds, using the exam-side id from each clash.
  const examIds = new Set(data.exams.map((e) => e.id));
  const examClashes = new Map<string, ClashKind[]>();
  for (const c of data.clashes) {
    if (!EXAM_CLASH_KINDS.includes(c.kind)) continue;
    const examId = examIds.has(c.a.id) ? c.a.id : c.b.id;
    const list = examClashes.get(examId) ?? [];
    list.push(c.kind);
    examClashes.set(examId, list);
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exam Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Final examination dates for {user.role === "STUDENT" ? "your section" : "your scope"}.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {examRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exams scheduled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Hall</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examRows.map(({ exam, cls }) => {
                  const flags = examClashes.get(exam.id) ?? [];
                  return (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">
                        {exam.date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">{cls.courseCode}</span>{" "}
                        {exam.courseTitle}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {minToLabel(exam.startMin)}–{minToLabel(exam.endMin)}
                      </TableCell>
                      <TableCell>{exam.hall ?? "TBA"}</TableCell>
                      <TableCell className="space-x-1">
                        {flags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          flags.map((k, i) => <ClashBadge key={i} kind={k} />)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
