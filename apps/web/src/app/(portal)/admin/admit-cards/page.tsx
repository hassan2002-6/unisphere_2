import Link from "next/link";
import { CircleAlert, CircleCheck, ClipboardCheck, IdCard, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listAdmitCardBoard, missingPrerequisites } from "@/server/services/admit-cards";
import { listAllTemplates } from "@/server/services/forms-admin";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setAdmitCardRuleAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Admin → Admit Cards (spec §10): the prerequisite rule plus the eligibility
 * board over all active students. Downloads from here are watermarked
 * INTERNAL PREVIEW PDFs — never an official university-issued card.
 */
export default async function AdminAdmitCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "admitcards.manage")) {
    return (
      <>
        <PageHeader icon={ClipboardCheck} title="Admit cards" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Admit-card configuration is limited to administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  const { ok, error } = await searchParams;
  const [{ rule, rows }, templates] = await Promise.all([listAdmitCardBoard(user), listAllTemplates()]);

  const eligibleCount = rows.filter((r) => r.eligibility.eligible).length;

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        title="Admit cards"
        description="Configure the eligibility prerequisites, then track who qualifies. Eligible students can download an internal preview PDF — clearly watermarked as not an official university-issued card."
      />

      {ok ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{ok.replaceAll("_", " ")}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="h-4 w-4 text-muted-foreground" />
              Eligibility board
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {eligibleCount} of {rows.length} eligible
              </span>
            </CardTitle>
            <CardDescription>
              Every active student against the current rule. “Download preview PDF” issues the watermarked internal preview for eligible
              students only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <EmptyState icon={IdCard} title="No active students" description="Students appear here once their accounts are active." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Student</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead className="text-right">Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ student, eligibility }) => {
                    const missing = missingPrerequisites(eligibility.checks);
                    const softNotes = eligibility.checks.filter((c) => c.soft);
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <span className="font-medium">{student.name}</span>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{student.registrationNo ?? "—"}</TableCell>
                        <TableCell>
                          {eligibility.eligible ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                              <CircleCheck className="h-3.5 w-3.5" /> Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                              <CircleAlert className="h-3.5 w-3.5" /> Not eligible
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {missing.length === 0 && softNotes.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <ul className="space-y-1 text-xs">
                              {missing.map((c) => (
                                <li key={c.key} className="text-destructive">
                                  {c.detail}
                                </li>
                              ))}
                              {softNotes.map((c) => (
                                <li key={c.key} className="text-muted-foreground">
                                  Note: {c.detail}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {eligibility.eligible ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/api/admit-card/${student.id}`} prefetch={false}>
                                Download preview PDF
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Resolve prerequisites first</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              Prerequisites
            </CardTitle>
            <CardDescription>
              Applied live to every eligibility check. Fee clearance is a soft note — the portal keeps no fee ledger, so it never blocks
              anyone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={setAdmitCardRuleAction} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs" htmlFor="admit-exam-label">
                  Exam label
                </Label>
                <Input
                  id="admit-exam-label"
                  name="examLabel"
                  defaultValue={rule.examLabel}
                  maxLength={80}
                  required
                  placeholder="Semester Examinations"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs" htmlFor="admit-required-form">
                  Required approved form
                </Label>
                <select
                  id="admit-required-form"
                  name="requiredFormKey"
                  defaultValue={rule.requiredFormKey ?? ""}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">No required form</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.key}>
                      {t.title} ({t.key}){t.active ? "" : " — inactive"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  The student must hold an APPROVED submission of the selected form before the admit card is issued.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="requireEnrollment" value="1" defaultChecked={rule.requireEnrollment} className="size-3.5 accent-primary" />
                Require at least one enrollment record
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="feeClearanceEnabled" value="1" defaultChecked={rule.feeClearanceEnabled} className="size-3.5 accent-primary" />
                Show the fee-clearance reminder
              </label>
              <p className="text-[11px] text-muted-foreground">
                Fee clearance is not tracked in the portal — enabling this only adds a “confirm at the accounts office” note; it never
                blocks eligibility.
              </p>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…" className="w-fit">
                Save configuration
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
