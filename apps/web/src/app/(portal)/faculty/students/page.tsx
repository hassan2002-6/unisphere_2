import Link from "next/link";
import { Search, UserSearch } from "lucide-react";
import { requireUser, requireCapability } from "@/lib/auth";
import { searchStudents, type StudentSearchRow } from "@/server/services/students";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function metaLine(semester: number | null, section: string | null): string {
  const parts: string[] = [];
  if (semester !== null) parts.push(`Semester ${semester}`);
  if (section) parts.push(`Section ${section}`);
  return parts.join(" · ") || "—";
}

function filterSummary(query: string, courseCode: string, semester?: number): string {
  const parts: string[] = [];
  if (query) parts.push(`"${query}"`);
  if (courseCode) parts.push(`course ${courseCode}`);
  if (semester !== undefined) parts.push(`semester ${semester}`);
  return parts.join(" · ") || "your search";
}

/** Faculty-facing student search — permitted academic directory (spec §6). */
export default async function FacultyStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; courseCode?: string; semester?: string }>;
}) {
  await requireUser();
  await requireCapability("students.search");

  const { q, courseCode, semester } = await searchParams;
  const query = (q ?? "").trim();
  const course = (courseCode ?? "").trim();
  const parsedSemester = semester ? Number.parseInt(semester, 10) : NaN;
  const semesterFilter = Number.isFinite(parsedSemester) ? parsedSemester : undefined;
  const searched = query.length > 0 || course.length > 0 || semesterFilter !== undefined;

  let rows: StudentSearchRow[] | null = null;
  let dbError = false;
  if (searched) {
    try {
      rows = await searchStudents(query, { courseCode: course || undefined, semester: semesterFilter });
    } catch (error) {
      console.error("student search failed:", error);
      dbError = true;
    }
  }

  return (
    <>
      <PageHeader
        icon={UserSearch}
        title="Students"
        description="Search the student directory by name, registration number or email — add a course code or semester to narrow the list."
      />

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold">Find a student</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name, reg no or email</span>
              <Input name="q" defaultValue={query} placeholder="e.g. Ali Raza · 23-0417 · ali@shu.edu.pk" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Course code (optional)</span>
              <Input name="courseCode" defaultValue={course} placeholder="e.g. CS-301" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Semester (optional)</span>
              <select
                name="semester"
                defaultValue={semesterFilter !== undefined ? String(semesterFilter) : ""}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">Any semester</option>
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
              {searched ? (
                <Button asChild variant="ghost">
                  <Link href="/faculty/students">Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Student directory unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : null}

      {!searched ? (
        <EmptyState
          icon={UserSearch}
          title="Search the student directory"
          description="Enter a name, registration number or email — add a course code or semester to narrow it down — then hit Search."
        />
      ) : null}

      {searched && !dbError && rows !== null && rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No students match"
          description={`Nothing matched ${filterSummary(query, course, semesterFilter)}. Check the spelling or try a broader search — partial names and registration numbers work.`}
          action={
            <Button asChild variant="outline">
              <Link href="/faculty/students">Clear search</Link>
            </Button>
          }
        />
      ) : null}

      {rows !== null && rows.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">
              {rows.length} {rows.length === 1 ? "student" : "students"} found
              {rows.length >= 25 ? (
                <span className="ml-2 font-normal text-muted-foreground">— showing the first 25, refine to narrow</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Registration no</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Program / semester</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="pr-5 text-right">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-5 font-mono text-xs">{s.registrationNo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <span>{s.program ?? "—"}</span>
                      <p className="text-xs text-muted-foreground">{metaLine(s.semester, s.section)}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.email}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/faculty/students/${s.id}`}>View profile</Link>
                      </Button>
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
