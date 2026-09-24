import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/** Faculty directory with teaching load — coordinator view. */
export default async function CoordinatorFacultyPage() {
  const user = await requireUser();

  if (!can(user.role, "clashes.view")) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No access</CardTitle>
            <CardDescription>The faculty directory in this view is limited to the coordination office.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  let faculty: { id: string; name: string; email: string; department: string | null; designation: string | null; courses: number }[] | null = null;
  try {
    const rows = await prisma.user.findMany({
      where: { role: "FACULTY" },
      orderBy: { name: "asc" },
      include: {
        facultyProfile: { select: { designation: true } },
        classes: { select: { id: true } },
      },
    });
    faculty = rows.map((f) => ({
      id: f.id,
      name: f.name,
      email: f.email,
      department: f.department,
      designation: f.facultyProfile?.designation ?? null,
      courses: f.classes.length,
    }));
  } catch {
    faculty = null;
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Faculty</h1>
        <p className="text-sm text-muted-foreground">Teaching load per faculty member — used when resolving clashes.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {faculty === null ? (
            <p className="text-sm text-muted-foreground">
              The database did not answer — check DATABASE_URL and the Neon project.
            </p>
          ) : faculty.length === 0 ? (
            <p className="text-sm text-muted-foreground">No faculty accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faculty.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.designation ?? "—"}</TableCell>
                    <TableCell>{f.department ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.email}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.courses}</TableCell>
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
