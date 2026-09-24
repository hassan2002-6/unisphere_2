import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getInternship } from "@/server/services/internships";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
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
    <main className="space-y-4 p-6">
      {applied ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Application sent — the poster will review it.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{internship.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {internship.company} · posted by {internship.postedBy.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {internship.status === "OPEN" ? <Badge variant="secondary">Open</Badge> : <Badge variant="outline">Closed</Badge>}
          {myApplication ? <StatusBadge status={myApplication.status} /> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">About the role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap text-muted-foreground">{internship.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {internship.location ? <span>📍 {internship.location}</span> : null}
              {internship.mode ? <span>🏢 {internship.mode}</span> : null}
              {internship.stipend ? <span>💰 {internship.stipend}</span> : null}
              {internship.deadline ? (
                <span>
                  ⏳ apply by{" "}
                  {internship.deadline.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                </span>
              ) : null}
              <span>👥 {internship._count.applications} applicants</span>
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
            <CardTitle className="text-base">Apply</CardTitle>
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
                <Button type="submit">Apply now</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                {internship.status === "OPEN"
                  ? "Sign in as a student account to apply."
                  : "Applications are closed for this posting."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
