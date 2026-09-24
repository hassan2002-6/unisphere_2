import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listInternships, listMyApplications } from "@/server/services/internships";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;

  let internships: Awaited<ReturnType<typeof listInternships>> = [];
  let applications: Awaited<ReturnType<typeof listMyApplications>> = [];
  let dbError = false;
  try {
    [internships, applications] = await Promise.all([
      listInternships({ query: q }),
      listMyApplications(user),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Internships</h1>
          <p className="text-sm text-muted-foreground">
            Openings shared with SHU students — apply in one click, track everything here.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Search title, company, tag…" className="w-64" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internships unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {internships.map((i) => (
          <Card key={i.id} className="flex flex-col">
            <CardHeader className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{i.title}</CardTitle>
                  <CardDescription>
                    {i.company} · posted by {i.postedBy.name}
                  </CardDescription>
                </div>
                {i.status === "OPEN" ? <Badge variant="secondary">Open</Badge> : <Badge variant="outline">Closed</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <p className="line-clamp-3 text-sm text-muted-foreground">{i.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {i.location ? <span>{i.location}</span> : null}
                {i.mode ? <span>· {i.mode}</span> : null}
                {i.stipend ? <span>· {i.stipend}</span> : null}
                {i.deadline ? <span>· apply by {i.deadline.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })}</span> : null}
                <span>· {i._count.applications} applicants</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {i.tags.slice(0, 5).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/internships/${i.id}`}>View &amp; apply</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {internships.length === 0 && !dbError ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No openings found</CardTitle>
              <CardDescription>Try a different search — new postings appear here as they come in.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">My applications ({applications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven&apos;t applied to anything yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/internships/${a.internshipId}`}>
                        {a.internship.title}
                      </Link>
                    </TableCell>
                    <TableCell>{a.internship.company}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.createdAt.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
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
