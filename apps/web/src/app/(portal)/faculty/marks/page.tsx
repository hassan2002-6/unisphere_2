import Link from "next/link";
import { BadgeCheck, BookOpen, ClipboardList, GraduationCap } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { getFacultyMarksOverview } from "@/server/services/marks";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function FacultyMarksPage() {
  const user = await requireCapability("marks.manage");

  let rows: Awaited<ReturnType<typeof getFacultyMarksOverview>> | null = null;
  try {
    rows = await getFacultyMarksOverview(user);
  } catch (error) {
    console.error("faculty marks load failed:", error);
    rows = null;
  }

  if (!rows) {
    return (
      <>
        <PageHeader icon={GraduationCap} title="Marks Entry" />
        <Alert variant="destructive">
          <AlertTitle>Marks unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const totalStudents = rows.reduce((n, r) => n + r.students, 0);
  const totalAssessments = rows.reduce((n, r) => n + r.assessments, 0);
  const classesPublished = rows.filter((r) => r.published > 0);
  const noAssessments = rows.filter((r) => r.assessments === 0).length;

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="Marks Entry"
        description="Your classes, their assessment counts and published results. Open a class to enter marks or publish grades."
      />

      {rows.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Classes"
            value={rows.length}
            hint={`${totalStudents} student${totalStudents === 1 ? "" : "s"} enrolled`}
            icon={BookOpen}
            tone="primary"
          />
          <StatCard
            label="Assessments"
            value={totalAssessments}
            hint={
              noAssessments > 0
                ? `${noAssessments} class${noAssessments === 1 ? "" : "es"} with none yet`
                : "Every class set up"
            }
            icon={ClipboardList}
            tone="info"
          />
          <StatCard
            label="Classes published"
            value={classesPublished.length}
            hint={
              classesPublished.length
                ? `Results live for ${classesPublished.map((r) => r.courseCode).slice(0, 3).join(", ")}`
                : "No results published yet"
            }
            icon={BadgeCheck}
            tone={classesPublished.length ? "success" : "default"}
          />
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes to grade"
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
                  <TableHead>Assessments</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="pr-5 text-right">Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const href = `/faculty/marks/${r.classId}`;
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
                      <TableCell className="font-mono text-xs tabular-nums">{r.assessments}</TableCell>
                      <TableCell>
                        {r.published > 0 ? (
                          <Badge variant="outline" className="border-success/25 bg-success/10 text-success">
                            {r.published} student{r.published === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not published</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={href}>Enter marks</Link>
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
