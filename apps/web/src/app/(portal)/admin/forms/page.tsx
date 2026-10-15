import Link from "next/link";
import { FilePlus2, FileStack, FormInput, Inbox, Paperclip } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listAllTemplates, listSubmissionsAdmin } from "@/server/services/forms-admin";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveTemplateAction, toggleTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLES = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"] as const;

/** Live field preview — reads a template's stored spec and renders what submitters will see. */
function FieldsPreview({ fields }: { fields: unknown }) {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  const specs = fields.filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null);
  const labels = specs
    .map((f) => String(f.label ?? "?"))
    .join(" · ");
  return (
    <details className="group/preview max-w-xs">
      <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
        {specs.length} field{specs.length === 1 ? "" : "s"} — {labels}
      </summary>
      <div className="mt-2 grid gap-2 rounded-md border bg-muted/30 p-3">
        {specs.map((f, i) => (
          <div key={i} className="grid gap-1">
            <span className="text-[11px] font-medium">
              {String(f.label ?? "Field")}
              {f.required ? <span className="text-destructive"> *</span> : null}
            </span>
            {f.type === "textarea" ? (
              <div className="h-9 rounded-md border bg-background/60" />
            ) : f.type === "checkbox" ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-3.5 rounded-sm border" /> Check to select
              </span>
            ) : (
              <div className="flex h-7 items-center rounded-md border bg-background/60 px-2 text-[11px] text-muted-foreground">
                {f.type === "select"
                  ? Array.isArray(f.options) && f.options.length
                    ? (f.options as string[]).slice(0, 4).join(" / ")
                    : "Choose…"
                  : f.type === "date"
                    ? "dd/mm/yyyy"
                    : f.type === "number"
                      ? "0"
                      : f.type === "email"
                        ? "name@shu.edu.pk"
                        : "Type here…"}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

/** Turn a template's stored field spec back into the one-line-per-field text. */
function fieldsToText(fields: unknown): string {
  if (!Array.isArray(fields)) return "";
  return fields
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => {
      const parts = [String(f.label ?? ""), String(f.type ?? "text")];
      if (!f.required) parts.push("optional");
      if (Array.isArray(f.options)) parts.push((f.options as string[]).join(", "));
      return parts.join(" | ");
    })
    .join("\n");
}

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Forms Manager (spec §11 + §D): configure which university forms exist, who
 * reviews them, their fields, versions and required documents — and browse
 * every submission with filters.
 */
export default async function AdminFormsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    edit?: string;
    status?: string;
    templateId?: string;
    q?: string;
    from?: string;
    to?: string;
    skip?: string;
  }>;
}) {
  await requireCapability("users.manage");
  const sp = await searchParams;
  const templates = await listAllTemplates();

  const editing = sp.edit ? templates.find((t) => t.id === sp.edit) : undefined;

  const skip = Math.max(Number(sp.skip ?? "0") || 0, 0);
  const submissions = await listSubmissionsAdmin(await requireCapability("users.manage"), {
    status: sp.status,
    templateId: sp.templateId,
    q: sp.q,
    from: sp.from,
    to: sp.to,
    skip,
    take: 25,
  });

  const studentCount = templates.filter((t) => t.audienceRole === "STUDENT").length;
  const facultyCount = templates.filter((t) => t.audienceRole === "FACULTY").length;
  const inactiveCount = templates.filter((t) => !t.active).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Data management", href: "/admin/data" },
          { label: "Forms Manager" },
        ]}
        icon={FormInput}
        title="Forms Manager"
        description="Configure the university's request forms — fields, approval, versions and required documents — and browse every submission."
      />

      {sp.saved ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{sp.saved}</AlertDescription>
        </Alert>
      ) : null}
      {sp.error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileStack className="h-4 w-4 text-muted-foreground" />
            Configured forms ({templates.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {studentCount} student · {facultyCount} faculty · {inactiveCount} deactivated ·{" "}
            {templates.reduce((n, t) => n + t.submissions, 0)} submissions all-time
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Form</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Reviewed by</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Ver.</TableHead>
                <TableHead className="text-right">Submissions</TableHead>
                <TableHead className="pr-5 text-right">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} className={t.active ? undefined : "opacity-60"}>
                  <TableCell className="pl-5 align-top">
                    <span className="font-medium">{t.title}</span>
                    <p className="text-[11px] text-muted-foreground">
                      {t.key} · to {t.recipientLabel}
                      {t.slaDays ? ` · SLA ${t.slaDays}d` : ""}
                      {t.requiresAttachment ? " · needs document" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="secondary">{t.audienceRole.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground">{t.reviewerRole.replace("_", " ")}</TableCell>
                  <TableCell className="align-top">
                    <FieldsPreview fields={t.fields} />
                  </TableCell>
                  <TableCell className="align-top text-xs tabular-nums text-muted-foreground">v{t.version}</TableCell>
                  <TableCell className="align-top text-right tabular-nums">
                    <Link href={`/admin/forms?templateId=${t.id}`} className="hover:underline">
                      {t.submissions}
                    </Link>
                  </TableCell>
                  <TableCell className="pr-5 align-top text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/forms?edit=${t.id}#editor`}>Edit</Link>
                      </Button>
                      <form action={toggleTemplateAction} className="inline-flex">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="next" value={t.active ? "false" : "true"} />
                        <Button type="submit" variant={t.active ? "outline" : "default"} size="sm">
                          {t.active ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            Submissions ({submissions.total})
          </CardTitle>
          <p className="text-xs text-muted-foreground">Filter by status, form, applicant or date range. Newest first.</p>
        </CardHeader>
        <CardContent className="space-y-3 px-5 py-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Status
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm text-foreground shadow-xs outline-none"
              >
                <option value="">Any</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="CORRECTIONS_REQUESTED">Corrections requested</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Form
              <select
                name="templateId"
                defaultValue={sp.templateId ?? ""}
                className="border-input h-9 max-w-56 rounded-md border bg-transparent px-2.5 text-sm text-foreground shadow-xs outline-none"
              >
                <option value="">All forms</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Applicant
              <Input name="q" defaultValue={sp.q ?? ""} placeholder="Name, email or reg no…" className="h-9 w-48" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              From
              <Input type="date" name="from" defaultValue={sp.from ?? ""} className="h-9" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              To
              <Input type="date" name="to" defaultValue={sp.to ?? ""} className="h-9" />
            </label>
            <Button type="submit" variant="secondary" size="sm" className="h-9">
              Filter
            </Button>
          </form>

          {submissions.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions match these filters.</p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Form</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed</TableHead>
                    <TableHead className="pr-4 text-right">Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-4 align-top">
                        <span className="text-sm font-medium">{s.template.title}</span>
                        <p className="text-[11px] text-muted-foreground">
                          v{s.templateVersion} · current step {s.currentStep + 1}/{Math.max(s.chain.length, 1)}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="text-sm">{s.submittedBy.name}</span>
                        <p className="text-[11px] text-muted-foreground">
                          {s.submittedBy.registrationNo ?? s.submittedBy.email}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">{fmt(s.createdAt)}</TableCell>
                      <TableCell className="pr-4 align-top text-right">
                        {s.attachmentName ? (
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/api/submissions/${s.id}/attachment`}>
                              <Paperclip className="h-3.5 w-3.5" />
                              {s.attachmentName.length > 22 ? `${s.attachmentName.slice(0, 20)}…` : s.attachmentName}
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>
                  Showing {skip + 1}–{skip + submissions.items.length} of {submissions.total}
                </span>
                <div className="flex gap-2">
                  {skip > 0 ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={{ query: { ...sp, skip: Math.max(skip - 25, 0) } }}>Previous</Link>
                    </Button>
                  ) : null}
                  {submissions.hasMore ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={{ query: { ...sp, skip: skip + 25 } }}>Next</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="editor">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FilePlus2 className="h-4 w-4 text-muted-foreground" />
            {editing ? `Edit “${editing.title}” (v${editing.version})` : "Add a form"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            One field per line: <code className="rounded bg-muted px-1 py-0.5">Label | type | optional</code> — types: text,
            textarea, number, date, select (then <code className="rounded bg-muted px-1 py-0.5">| Option A, Option B</code>).
            Changing the fields bumps the version — existing submissions keep their answers.
            {editing ? (
              <>
                {" "}
                <Link href="/admin/forms#editor" className="font-medium text-foreground underline underline-offset-2">
                  Cancel edit
                </Link>
              </>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <form action={saveTemplateAction} className="grid gap-4">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required minLength={4} defaultValue={editing?.title ?? ""} placeholder="Hostel Leave Application" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="key">Key {editing ? "(locked while editing)" : "(optional — derived from the title)"}</Label>
                <Input id="key" name="key" defaultValue={editing?.key ?? ""} readOnly={Boolean(editing)} placeholder="hostel-leave" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                required
                minLength={8}
                defaultValue={editing?.description ?? ""}
                placeholder="Apply for hostel leave with guardian confirmation."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="audienceRole">Audience</Label>
                <select
                  id="audienceRole"
                  name="audienceRole"
                  className="border-input h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={editing?.audienceRole ?? "STUDENT"}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="reviewerRole">Reviewed by</Label>
                <select
                  id="reviewerRole"
                  name="reviewerRole"
                  className="border-input h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={editing?.reviewerRole ?? "COORDINATOR"}
                >
                  {(["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"] as const).map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="recipientLabel">Recipient label</Label>
                <Input id="recipientLabel" name="recipientLabel" defaultValue={editing?.recipientLabel ?? ""} placeholder="Coordination Office" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="slaDays">SLA (days, optional)</Label>
                <Input id="slaDays" name="slaDays" type="number" min={1} max={60} defaultValue={editing?.slaDays ?? ""} placeholder="3" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="attachmentLabel">Supporting document label (optional)</Label>
                <Input
                  id="attachmentLabel"
                  name="attachmentLabel"
                  defaultValue={editing?.attachmentLabel ?? ""}
                  placeholder="e.g. Medical certificate / Transcript copy"
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="requiresAttachment"
                  defaultChecked={editing?.requiresAttachment ?? false}
                  className="size-4 accent-primary"
                />
                Document required
              </label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fieldsText">Fields</Label>
              <Textarea
                id="fieldsText"
                name="fieldsText"
                rows={5}
                required
                defaultValue={editing ? fieldsToText(editing.fields) : ""}
                placeholder={"Reason | textarea\nFrom date | date\nTo date | date\nGuardian contact | text | optional"}
              />
            </div>
            <div>
              <Button type="submit">{editing ? "Save changes" : "Create form"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
