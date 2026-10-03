import Link from "next/link";
import { Briefcase, Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listInternships, listMyApplications } from "@/server/services/internships";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    <>
      <PageHeader
        icon={Briefcase}
        title="Internships"
        description="Openings shared with SHU students — apply in one click, track everything here."
        actions={
          <form className="flex items-center gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Search title, company, tag…" className="w-64" />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        }
      />

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Internships unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check DATABASE_URL and the Neon project.</AlertDescription>
        </Alert>
      ) : null}

      {!dbError && (internships.length > 0 || applications.length > 0) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Openings"
            value={internships.length}
            hint={q ? "Matching your search" : "Shared with SHU students"}
            icon={Briefcase}
            tone="primary"
          />
          <StatCard
            label="My applications"
            value={applications.length}
            hint={applications.length > 0 ? "Statuses update as posters act" : "Nothing submitted yet"}
            icon={Send}
            tone={applications.length > 0 ? "info" : "default"}
          />
        </section>
      ) : null}

      {!dbError && internships.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No openings found"
          description="Try a different search — new postings appear here as they come in."
          action={
            q ? (
              <Button asChild variant="outline">
                <Link href="/internships">Clear search</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!dbError && internships.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <StatusBadge status={i.status} />
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
        </div>
      ) : null}

      {!dbError ? (
        applications.length === 0 ? (
          <EmptyState
            compact
            icon={Send}
            title="No applications yet"
            description="You haven't applied to anything yet — open a posting and apply in one click."
          />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-5">Position</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5 font-medium">
                        <Link className="hover:underline" href={`/internships/${a.internshipId}`}>
                          {a.internship.title}
                        </Link>
                      </TableCell>
                      <TableCell>{a.internship.company}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.createdAt.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="pr-5">
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : null}
    </>
  );
}
