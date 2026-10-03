import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getClassesFor, minToLabel, formatDay } from "@/server/services/schedule";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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
      <>
        <PageHeader icon={BookOpen} title="My Courses" />
        <Alert variant="destructive">
          <AlertTitle>Courses unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  const teaching = user.role === "FACULTY" ? classes : [];
  const shown = user.role === "FACULTY" ? teaching : classes;

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="My Courses"
        description={
          user.role === "FACULTY"
            ? "Courses you are teaching this semester, with their weekly slots."
            : "All courses in the system (read-only view for your role)."
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses assigned yet"
          description="Courses appear here with their weekly slots as soon as they are assigned."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Course</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Weekly slots</TableHead>
                  <TableHead className="pr-5">Instructor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5">
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
                    <TableCell className="pr-5">{c.faculty?.name ?? "—"}</TableCell>
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
