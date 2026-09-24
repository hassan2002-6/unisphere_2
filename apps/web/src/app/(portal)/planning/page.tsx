import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const user = await requireUser();

  let courses: { semester: number; courseCode: string; title: string; credits: number; category: string | null }[] | null =
    null;
  try {
    courses = await prisma.degreePlanCourse.findMany({
      where: { program: "BSCS" },
      orderBy: [{ semester: "asc" }, { courseCode: "asc" }],
      select: { semester: true, courseCode: true, title: true, credits: true, category: true },
    });
  } catch {
    courses = null;
  }

  if (!courses) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Academic planning unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const bySemester = new Map<number, typeof courses>();
  for (const c of courses) {
    const list = bySemester.get(c.semester) ?? [];
    list.push(c);
    bySemester.set(c.semester, list);
  }
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

  const currentSemester =
    user.role === "STUDENT" ? (await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { semester: true } }))?.semester ?? null : null;

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Academic Planning</h1>
        <p className="text-sm text-muted-foreground">
          BSCS degree plan — 8 semesters · {courses.length} courses · {totalCredits} credit hours total.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[...bySemester.entries()].map(([semester, list]) => {
          const credits = list.reduce((sum, c) => sum + c.credits, 0);
          const isCurrent = currentSemester === semester;
          return (
            <Card key={semester} className={isCurrent ? "ring-2 ring-primary/40" : undefined}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Semester {semester}</CardTitle>
                  {isCurrent ? <Badge>current</Badge> : <Badge variant="secondary">{credits} cr</Badge>}
                </div>
                <CardDescription>{list.length} courses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {list.map((c) => (
                  <div key={c.courseCode} className="flex items-baseline justify-between gap-2 text-sm">
                    <span>
                      <span className="font-mono text-xs text-muted-foreground">{c.courseCode}</span> {c.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.credits} cr</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm">Course registration</CardTitle>
          <CardDescription>
            Registration &amp; prerequisite checks arrive with the enrollment module (post-M2); this plan is the
            data foundation.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
