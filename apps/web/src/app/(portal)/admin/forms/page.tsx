import { FilePlus2, FileStack, FormInput } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listAllTemplates } from "@/server/services/forms-admin";
import { PageHeader } from "@/components/page-header";
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

function FieldsPreview({ fields }: { fields: unknown }) {
  if (!Array.isArray(fields)) return null;
  return (
    <span className="text-[11px] text-muted-foreground">
      {fields
        .map((f) => (f && typeof f === "object" && "label" in f ? String((f as { label: unknown }).label) : "?"))
        .join(" · ")}
    </span>
  );
}

/**
 * Forms Manager (spec §11): the administration configures which university
 * forms exist, who reviews them, and can add or retire forms at any time.
 */
export default async function AdminFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireCapability("users.manage");
  const { saved, error } = await searchParams;
  const templates = await listAllTemplates();

  const studentCount = templates.filter((t) => t.audienceRole === "STUDENT").length;
  const facultyCount = templates.filter((t) => t.audienceRole === "FACULTY").length;
  const inactiveCount = templates.filter((t) => !t.active).length;

  return (
    <>
      <PageHeader
        icon={FormInput}
        title="Forms Manager"
        description="Configure the university's request forms: who can submit them, who reviews them, and their fields. Deactivated forms disappear from the Forms Center immediately."
      />

      {saved ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{saved}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="secondary">{t.audienceRole.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground">{t.reviewerRole.replace("_", " ")}</TableCell>
                  <TableCell className="align-top">
                    <FieldsPreview fields={t.fields} />
                  </TableCell>
                  <TableCell className="align-top text-right tabular-nums">{t.submissions}</TableCell>
                  <TableCell className="pr-5 align-top text-right">
                    <form action={toggleTemplateAction} className="inline-flex">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="next" value={t.active ? "false" : "true"} />
                      <Button type="submit" variant={t.active ? "outline" : "default"} size="sm">
                        {t.active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
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
            <FilePlus2 className="h-4 w-4 text-muted-foreground" />
            Add a form
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            One field per line: <code className="rounded bg-muted px-1 py-0.5">Label | type | optional</code> — types: text,
            textarea, number, date, select (then <code className="rounded bg-muted px-1 py-0.5">| required | Option A, Option B</code>)
          </p>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <form action={saveTemplateAction} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required minLength={4} placeholder="Hostel Leave Application" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="key">Key (optional — derived from the title)</Label>
                <Input id="key" name="key" placeholder="hostel-leave" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required minLength={8} placeholder="Apply for hostel leave with guardian confirmation." />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="audienceRole">Audience</Label>
                <select id="audienceRole" name="audienceRole" className="h-9 rounded-md border bg-background px-3 text-sm" defaultValue="STUDENT">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="reviewerRole">Reviewed by</Label>
                <select id="reviewerRole" name="reviewerRole" className="h-9 rounded-md border bg-background px-3 text-sm" defaultValue="COORDINATOR">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="recipientLabel">Recipient label</Label>
                <Input id="recipientLabel" name="recipientLabel" placeholder="Coordination Office" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="slaDays">SLA (days, optional)</Label>
                <Input id="slaDays" name="slaDays" type="number" min={1} max={60} placeholder="3" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fieldsText">Fields</Label>
              <Textarea
                id="fieldsText"
                name="fieldsText"
                rows={4}
                required
                placeholder={"Reason | textarea\nFrom date | date\nTo date | date\nGuardian contact | text | optional"}
              />
            </div>
            <div>
              <Button type="submit">Create form</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
