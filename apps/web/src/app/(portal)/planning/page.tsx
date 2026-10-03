import Link from "next/link";
import { BookOpen, GraduationCap, Info, Layers } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PlanCourse = {
  semester: number;
  courseCode: string;
  title: string;
  credits: number;
  category: string | null;
};

export default async function PlanningPage() {
  const user = await requireUser();

  let courses: PlanCourse[] | null = null;
  let profile: { semester: number | null; section: string | null; program: string } | null = null;
  try {
    [courses, profile] = await Promise.all([
      prisma.degreePlanCourse.findMany({
        where: { program: "BSCS" },
        orderBy: [{ semester: "asc" }, { courseCode: "asc" }],
        select: { semester: true, courseCode: true, title: true, credits: true, category: true },
      }),
      user.role === "STUDENT"
        ? prisma.studentProfile.findUnique({
            where: { userId: user.id },
            select: { semester: true, section: true, program: true },
          })
        : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error("planning load failed:", error);
    courses = null;
  }

  if (!courses) {
    return (
      <>
        <PageHeader icon={GraduationCap} title="Academic Planning" />
        <Alert variant="destructive">
          <AlertTitle>Academic planning unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const bySemester = new Map<number, PlanCourse[]>();
  for (const c of courses) {
    const list = bySemester.get(c.semester) ?? [];
    list.push(c);
    bySemester.set(c.semester, list);
  }
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  const currentSemester = profile?.semester ?? null;
  const maxSemCredits = Math.max(...[...bySemester.values()].map((l) => l.reduce((s, c) => s + c.credits, 0)), 1);

  if (courses.length === 0) {
    return (
      <>
        <PageHeader icon={GraduationCap} title="Academic Planning" />
        <EmptyState
          icon={GraduationCap}
          title="No degree plan loaded"
          description="The BSCS degree plan is loaded during seeding. Once present, every semester appears here with its courses and credits."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="Academic Planning"
        description={`BSCS degree plan — ${bySemester.size} semesters · ${courses.length} courses · ${totalCredits} credit hours.`}
        actions={
          user.role === "STUDENT" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/forms">Registration forms</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Courses in plan" value={courses.length} hint="Across all semesters" icon={BookOpen} tone="primary" />
        <StatCard label="Total credit hours" value={totalCredits} hint={`Avg ${Math.round(totalCredits / bySemester.size)} per semester`} icon={Layers} tone="info" />
        <StatCard
          label={currentSemester ? "Your semester" : "Semesters"}
          value={currentSemester ?? bySemester.size}
          hint={profile?.section ? `${profile.program} · Section ${profile.section}` : "Plan overview below"}
          icon={GraduationCap}
          tone={currentSemester ? "success" : "default"}
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...bySemester.entries()].map(([semester, list]) => {
          const credits = list.reduce((sum, c) => sum + c.credits, 0);
          const isCurrent = currentSemester === semester;
          const isPast = currentSemester !== null && semester < currentSemester;
          return (
            <Card
              key={semester}
              className={`flex flex-col gap-0 overflow-hidden py-0 ${
                isCurrent ? "ring-2 ring-primary/40" : isPast ? "opacity-75" : ""
              }`}
            >
              <CardHeader className="flex-row items-center justify-between border-b px-4 py-3">
                <CardTitle className="text-sm font-semibold">Semester {semester}</CardTitle>
                {isCurrent ? (
                  <Badge className="bg-primary/10 text-primary">current</Badge>
                ) : isPast ? (
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    completed
                  </Badge>
                ) : (
                  <Badge variant="secondary">{credits} cr</Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div
                  aria-hidden
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  title={`${credits} credit hours`}
                >
                  <div
                    className={`h-full rounded-full ${isCurrent ? "bg-primary" : isPast ? "bg-success/70" : "bg-info/60"}`}
                    style={{ width: `${Math.round((credits / maxSemCredits) * 100)}%` }}
                  />
                </div>
                <ul className="space-y-1.5">
                  {list.map((c) => (
                    <li key={c.courseCode} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-mono text-[11px] text-muted-foreground">{c.courseCode}</span>{" "}
                        <span className="truncate">{c.title}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.credits} cr</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Alert variant="muted">
        <AlertTitle className="flex items-center gap-1.5">
          <Info className="h-4 w-4" /> How registration works
        </AlertTitle>
        <AlertDescription>
          Course registration, prerequisite overrides and credit-load changes are processed through the{" "}
          <Link href="/forms" className="font-medium text-foreground underline underline-offset-2">
            Forms Center
          </Link>{" "}
          — pick the matching form and the coordination office reviews it with a full audit trail.
        </AlertDescription>
      </Alert>
    </>
  );
}
