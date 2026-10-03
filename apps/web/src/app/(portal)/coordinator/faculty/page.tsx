import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/** Faculty directory with teaching load — coordinator view. */
export default async function CoordinatorFacultyPage() {
  const user = await requireUser();

  if (!can(user.role, "clashes.view")) {
    return (
      <>
        <PageHeader icon={Users} title="Faculty" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>The faculty directory in this view is limited to the coordination office.</AlertDescription>
        </Alert>
      </>
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
    <>
      <PageHeader
        icon={Users}
        title="Faculty"
        description="Teaching load per faculty member — used when resolving clashes."
      />

      {faculty === null ? (
        <Alert variant="destructive">
          <AlertTitle>Faculty directory unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : faculty.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No faculty accounts yet"
          description="Faculty accounts are created by the admin office — once added, their teaching load shows up here."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="pr-5 text-right">Classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faculty.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="pl-5 font-medium">{f.name}</TableCell>
                    <TableCell>{f.designation ?? "—"}</TableCell>
                    <TableCell>{f.department ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.email}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{f.courses}</TableCell>
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
