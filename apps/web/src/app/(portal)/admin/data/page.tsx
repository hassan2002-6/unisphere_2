import Link from "next/link";
import { Database, FileSpreadsheet, GraduationCap, Library, MessageSquareWarning, Search, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

/**
 * Admin → Data: where records are entered and found. One searchable index over
 * the people, course sections, complaints and submissions an office touches,
 * plus the validated CSV import screen.
 */
export default async function AdminDataPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "users.manage")) {
    return (
      <>
        <PageHeader icon={Database} title="Data management" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Data management is limited to administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) ?? "";

  const results = q
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { registrationNo: { contains: q, mode: "insensitive" as const } },
              { employeeId: { contains: q, mode: "insensitive" as const } },
            ],
          },
          select: { id: true, name: true, email: true, role: true, registrationNo: true, employeeId: true },
          take: 8,
          orderBy: { name: "asc" },
        }),
        prisma.courseClass.findMany({
          where: {
            OR: [
              { courseCode: { contains: q, mode: "insensitive" as const } },
              { title: { contains: q, mode: "insensitive" as const } },
            ],
          },
          select: { id: true, courseCode: true, title: true, section: true, semester: true },
          take: 8,
        }),
        prisma.complaint.findMany({
          where: {
            OR: [
              { refNo: { contains: q, mode: "insensitive" as const } },
              { subject: { contains: q, mode: "insensitive" as const } },
            ],
          },
          select: { id: true, refNo: true, subject: true, status: true },
          take: 8,
        }),
      ])
    : [[], [], []];
  const [people, classes, complaints] = results;
  const hitCount = people.length + classes.length + complaints.length;

  const cards = [
    {
      href: "/admin/users",
      icon: Users,
      title: "People & accounts",
      body: "Create, edit, deactivate and search student, faculty, coordinator, FYP Head and admin accounts — and reset their sign-in.",
    },
    {
      href: "/admin/data/import",
      icon: FileSpreadsheet,
      title: "CSV import",
      body: "Bulk-enter students, faculty and course sections from validated CSV templates with per-row error reports.",
    },
    {
      href: "/admin/complaints",
      icon: MessageSquareWarning,
      title: "Complaint categories & routing",
      body: "The categories students can file under, who receives each one, default priority and automatic escalation.",
    },
    {
      href: "/admin/knowledge",
      icon: Library,
      title: "Knowledge base",
      body: "The approved sources the AI assistant may cite — and the questions it couldn’t answer, ready for review.",
    },
    {
      href: "/admin/forms",
      icon: GraduationCap,
      title: "Forms & approval chains",
      body: "Form templates, fields, required documents, reviewer chains and active/inactive status.",
    },
    {
      href: "/admin/audit",
      icon: Database,
      title: "Audit trail",
      body: "Every important administrative change, who made it and when.",
    },
  ];

  return (
    <>
      <PageHeader
        icon={Database}
        title="Data management"
        description="Enter records the straightforward way — search everything from one box, or follow the screens below."
      />

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-muted-foreground" />
            Quick find
          </CardTitle>
          <CardDescription>Search people (name, email, IDs), course sections, and complaints (ref no. or subject).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap gap-2">
            <Input name="q" defaultValue={q} placeholder="e.g. S22CSC001, CS-305, COMP-2026-0007, Ayesha…" className="max-w-md" />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>

          {q ? (
            hitCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing matched “{q}”.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {people.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">People</p>
                    {people.map((p) => (
                      <Link
                        key={p.id}
                        href={`/admin/users/${p.id}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                        </span>
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                          {p.registrationNo ?? p.employeeId ?? p.role}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {classes.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Course sections</p>
                    {classes.map((c) => (
                      <div key={c.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <span className="block font-medium">
                          {c.courseCode} — {c.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Section {c.section} · {c.semester}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {complaints.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Complaints</p>
                    {complaints.map((c) => (
                      <Link
                        key={c.id}
                        href={`/complaints/${c.id}`}
                        className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <span className="block truncate font-medium">{c.subject}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.refNo} · {c.status.replaceAll("_", " ").toLowerCase()}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Type at least a few characters — results appear grouped by people, course sections and complaints.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.href} className="flex flex-col">
            <CardHeader className="py-3.5">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <c.icon className="h-4 w-4 text-muted-foreground" />
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <p className="text-sm text-muted-foreground">{c.body}</p>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link href={c.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
