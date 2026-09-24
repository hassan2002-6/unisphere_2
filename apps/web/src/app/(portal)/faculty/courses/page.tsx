import { requireUser } from "@/lib/auth";
import { getClassesFor, minToLabel, formatDay } from "@/server/services/schedule";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function FacultyCoursesPage() {
  const user = await requireUser();

  let classes: Awaited<ReturnType<typeof getClassesFor>> | null = null;
  try {
    classes = await getClassesFor(user);
  } catch {
    classes = null;
  }

  if (!classes) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Courses unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const teaching = user.role === "FACULTY" ? classes : [];
  const shown = user.role === "FACULTY" ? teaching : classes;

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Courses</h1>
        <p className="text-sm text-muted-foreground">
          {user.role === "FACULTY"
            ? "Courses you are teaching this semester, with their weekly slots."
            : "All courses in the system (read-only view for your role)."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Weekly slots</TableHead>
                  <TableHead>Instructor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{c.courseCode}</span>{" "}
                      <span className="font-medium">{c.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.section}</Badge>
                    </TableCell>
                    <TableCell>{c.credits ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.slots.length === 0
                        ? "—"
                        : c.slots
                            .map((s) => `${formatDay(s.day)} ${minToLabel(s.startMin)}–${minToLabel(s.endMin)}${s.room ? ` (${s.room})` : ""}`)
                            .join(" · ")}
                    </TableCell>
                    <TableCell>{c.faculty?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
