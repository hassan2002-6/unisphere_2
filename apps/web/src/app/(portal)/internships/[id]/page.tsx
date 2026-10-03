import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Building2, CalendarClock, FileText, MapPin, Users, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getInternship } from "@/server/services/internships";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { applyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InternshipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ applied?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { applied, error } = await searchParams;

  let internship: Awaited<ReturnType<typeof getInternship>> = null;
  try {
    internship = await getInternship(id);
  } catch {
    internship = null;
  }
  if (!internship) notFound();

  let myApplication = null;
  try {
    myApplication = await prisma.internshipApplication.findUnique({
      where: { internshipId_studentId: { internshipId: id, studentId: user.id } },
    });
  } catch {
    myApplication = null;
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Internships", href: "/internships" }, { label: internship.title }]}
        icon={Briefcase}
        title={internship.title}
        description={`${internship.company} · posted by ${internship.postedBy.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={internship.status} />
            {myApplication ? <StatusBadge status={myApplication.status} /> : null}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/internships">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      {applied ? (
        <Alert variant="success">
          <AlertTitle>Application sent</AlertTitle>
          <AlertDescription>The poster will review it — you can track the status on this page.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not apply</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              About the role
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap text-muted-foreground">{internship.description}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {internship.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {internship.location}
                </span>
              ) : null}
              {internship.mode ? (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {internship.mode}
                </span>
              ) : null}
              {internship.stipend ? (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  {internship.stipend}
                </span>
              ) : null}
              {internship.deadline ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  apply by{" "}
                  {internship.deadline.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {internship._count.applications} applicants
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {internship.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
            {internship.applyUrl ? (
              <p className="text-xs text-muted-foreground">
                External listing:{" "}
                <a href={internship.applyUrl} className="underline" target="_blank" rel="noreferrer">
                  {internship.applyUrl}
                </a>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Apply</CardTitle>
            <CardDescription>
              {myApplication
                ? "You've applied — status shown at the top of this page."
                : internship.status === "OPEN"
                  ? "One-click apply with an optional note."
                  : "This posting is closed."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myApplication ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Your note:</p>
                <p className="whitespace-pre-wrap rounded-md border p-3 text-sm">
                  {myApplication.note ?? "(no note)"}
                </p>
              </div>
            ) : internship.status === "OPEN" && user.role === "STUDENT" ? (
              <form action={applyAction} className="grid gap-3">
                <input type="hidden" name="internshipId" value={internship.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor="note">Note to the poster (optional)</Label>
                  <Textarea id="note" name="note" rows={4} maxLength={1000} placeholder="Why you're a fit…" />
                </div>
                <SubmitButton pendingLabel="Applying…">Apply now</SubmitButton>
              </form>
            ) : (
              <Alert variant={internship.status === "OPEN" ? "warning" : "muted"}>
                <AlertDescription>
                  {internship.status === "OPEN"
                    ? "Sign in as a student account to apply."
                    : "Applications are closed for this posting."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
