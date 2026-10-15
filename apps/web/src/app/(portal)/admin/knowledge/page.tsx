import { Archive, ArchiveRestore, CircleHelp, Library, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { countUnanswered, listKnowledgeDocs, listUnanswered } from "@/server/services/knowledge-admin";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDocAction, reviewUnansweredAction, setDocArchivedAction, updateDocAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Admin → Knowledge (spec §9): the approved sources the AI assistant may cite,
 * plus the review queue of questions it could not ground.
 */
export default async function AdminKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; archived?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "knowledge.manage")) {
    return (
      <>
        <PageHeader icon={Library} title="Knowledge base" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Knowledge management is limited to administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  const { ok, error, q, archived } = await searchParams;
  const includeArchived = archived === "1";
  const [docs, unanswered, pendingCount] = await Promise.all([
    listKnowledgeDocs(user, { q, includeArchived }),
    listUnanswered(user),
    countUnanswered(user),
  ]);
  // One query for the full texts (the <details> editors need them inline).
  const fullDocs = docs.length
    ? await prisma.knowledgeDoc.findMany({
        where: { id: { in: docs.map((d) => d.id) } },
        select: { id: true, title: true, source: true, content: true, tags: true },
      })
    : [];
  const fullById = new Map(fullDocs.map((d) => [d.id, d]));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Data management", href: "/admin/data" }, { label: "Knowledge base" }]}
        icon={Library}
        title="Knowledge base"
        description="Everything here is citable by the assistant. Questions it couldn’t ground land in the review queue below."
        actions={
          <Badge variant={pendingCount > 0 ? "secondary" : "outline"} className="text-xs">
            {pendingCount} question{pendingCount === 1 ? "" : "s"} waiting
          </Badge>
        }
      />

      {ok ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{ok.replaceAll("_", " ")}.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CircleHelp className="h-4 w-4 text-muted-foreground" />
            Unanswered questions
          </CardTitle>
          <CardDescription>
            Questions with no matching knowledge document. Turn a good answer into a knowledge doc, then mark the
            question reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {unanswered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting — every recent question found a source.</p>
          ) : (
            <ul className="divide-y rounded-lg border border-border">
              {unanswered.map((u) => (
                <li key={u.id} className="grid gap-2 px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{u.question}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {u.role.replaceAll("_", " ").toLowerCase()}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {u.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <form action={reviewUnansweredAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <Input name="note" placeholder="Short note (optional) — e.g. added to Handbook §4.2" className="h-8 max-w-sm text-xs" />
                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                      Mark reviewed
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="text-sm font-semibold">Documents ({docs.length})</CardTitle>
            <CardDescription>Search by title or tag; archived documents are excluded from answers immediately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <Input name="q" defaultValue={q ?? ""} placeholder="Search title or tag…" className="h-8 max-w-xs" />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="size-3.5 accent-primary" />
                include archived
              </label>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>

            {docs.length === 0 ? (
              <EmptyState icon={Library} title="No documents" description="Add the first knowledge document on the right." />
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="rounded-lg border border-border">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3.5 py-2.5 text-sm">
                        <span className="font-medium">{d.title}</span>
                        {d.isArchived ? <Badge variant="destructive">archived</Badge> : null}
                        {d.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {d.source} · {d.updatedAt.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short" })}
                        </span>
                      </summary>
                      <div className="border-t px-3.5 py-3">
                        <DocEditForm
                          id={d.id}
                          doc={fullById.get(d.id)}
                          action={updateDocAction}
                          submitLabel="Save changes"
                        />
                        <form action={setDocArchivedAction} className="mt-3 border-t pt-3">
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="archived" value={d.isArchived ? "0" : "1"} />
                          <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                            {d.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                            {d.isArchived ? "Restore" : "Archive"}
                          </SubmitButton>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4 text-muted-foreground" />
              New knowledge document
            </CardTitle>
            <CardDescription>
              Write the policy in full sentences — the assistant quotes and cites this text verbatim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocEditForm action={createDocAction} submitLabel="Add document" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DocEditForm({
  id,
  doc,
  action,
  submitLabel,
}: {
  id?: string;
  doc?: { title: string; source: string; content: string; tags: string[] } | null;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-3">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Title</Label>
          <Input name="title" defaultValue={doc?.title ?? ""} maxLength={160} required placeholder="Attendance policy — minimum 75%" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Source / citation</Label>
          <Input name="source" defaultValue={doc?.source ?? ""} maxLength={200} required placeholder="SHU Student Handbook §4.2" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Tags (comma separated)</Label>
        <Input name="tags" defaultValue={doc?.tags.join(", ") ?? ""} placeholder="attendance, policy, exams" />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Content</Label>
        <Textarea name="content" rows={8} required defaultValue={doc?.content ?? ""} placeholder="The full policy text…" />
      </div>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…" className="w-fit">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
