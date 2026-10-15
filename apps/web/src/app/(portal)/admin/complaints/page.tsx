import { MessageSquareWarning, Plus, Route } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listComplaintCategories, listComplaintRoutes, listRouteTargets } from "@/server/services/complaints-admin";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/rbac";
import { createCategoryAction, deleteRouteAction, saveRouteAction, setCategoryActiveAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"] as const;

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "complaints.route")) {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title="Complaints configuration" />
        <Alert variant="warning">
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>Complaint configuration is limited to administrators.</AlertDescription>
        </Alert>
      </>
    );
  }

  const [{ ok, error }, categories, routes, targets] = await Promise.all([
    searchParams,
    listComplaintCategories(user),
    listComplaintRoutes(user),
    listRouteTargets(user),
  ]);
  const activeCategories = categories.filter((c) => c.active);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Data management", href: "/admin/data" }, { label: "Complaints configuration" }]}
        icon={MessageSquareWarning}
        title="Complaint categories & routing"
        description="What students can file under, who receives each category, the default priority, and when it escalates."
        actions={<Badge variant="secondary">{routes.length} routing rules</Badge>}
      />

      {ok ? (
        <Alert variant="success">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Complaint configuration updated ({ok.replaceAll("_", " ")}).</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="text-sm font-semibold">Categories</CardTitle>
            <CardDescription>Disabled categories stop appearing on the filing form — existing complaints keep theirs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y rounded-lg border border-border">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{c.key}</p>
                  </div>
                  <form action={setCategoryActiveAction} className="shrink-0">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                    <Button type="submit" variant={c.active ? "ghost" : "secondary"} size="sm">
                      {c.active ? "Disable" : "Enable"}
                    </Button>
                  </form>
                </li>
              ))}
              {categories.length === 0 ? <li className="px-3.5 py-3 text-sm text-muted-foreground">No categories yet.</li> : null}
            </ul>

            <form action={createCategoryAction} className="grid gap-3 border-t pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Add category</p>
              <div className="grid gap-1.5">
                <Label htmlFor="key" className="text-xs">
                  Key (internal)
                </Label>
                <Input id="key" name="key" placeholder="Hostel" maxLength={60} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="label" className="text-xs">
                  Label (shown to students)
                </Label>
                <Input id="label" name="label" placeholder="Hostel & accommodation" maxLength={80} required />
              </div>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Adding…" className="w-fit">
                <Plus className="h-3.5 w-3.5" />
                Add category
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Route className="h-4 w-4 text-muted-foreground" />
              Routing rules
            </CardTitle>
            <CardDescription>
              New complaints are assigned and prioritised from these rules. When a response is overdue past the
              escalation window, the case is escalated to the chosen role and flagged high priority.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {routes.map((r) => (
              <details key={r.id} className="group rounded-lg border border-border">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3.5 py-2.5 text-sm">
                  <Badge variant="secondary">{r.categoryKey}</Badge>
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <span>{r.targetUserName ?? (r.targetRole ? ROLE_LABELS[r.targetRole] : "unset")}</span>
                  <Badge variant="outline">priority: {r.defaultPriority.toLowerCase()}</Badge>
                  {r.escalateAfterHours ? (
                    <Badge variant="outline">
                      escalate {r.escalateAfterHours}h → {r.escalateToRole ? ROLE_LABELS[r.escalateToRole] : "—"}
                    </Badge>
                  ) : null}
                  {!r.active ? <Badge variant="destructive">disabled</Badge> : null}
                  <span className="ml-auto text-xs text-muted-foreground group-open:hidden">edit</span>
                </summary>
                <form action={saveRouteAction} className="grid gap-3 border-t px-3.5 py-3.5">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Category</Label>
                      <select
                        name="categoryKey"
                        defaultValue={r.categoryKey}
                        className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Target role</Label>
                      <select
                        name="targetRole"
                        defaultValue={r.targetRole ?? ""}
                        className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                      >
                        <option value="">— specific person —</option>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Specific person (optional)</Label>
                      <select
                        name="targetUserId"
                        defaultValue={r.targetUserId ?? ""}
                        className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                      >
                        <option value="">— use the role —</option>
                        {targets.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({ROLE_LABELS[t.role]})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Default priority</Label>
                      <select
                        name="defaultPriority"
                        defaultValue={r.defaultPriority}
                        className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Escalate after (hours)</Label>
                      <Input
                        name="escalateAfterHours"
                        type="number"
                        min={1}
                        max={720}
                        defaultValue={r.escalateAfterHours ?? ""}
                        placeholder="e.g. 48 — blank disables"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Escalate to</Label>
                      <select
                        name="escalateToRole"
                        defaultValue={r.escalateToRole ?? ""}
                        className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                      >
                        <option value="">— none —</option>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Sort order</Label>
                      <Input name="sortOrder" type="number" min={0} max={999} defaultValue={r.sortOrder} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Status</Label>
                      <select
                        name="active"
                        defaultValue={r.active ? "1" : "0"}
                        className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                      >
                        <option value="1">Active</option>
                        <option value="0">Disabled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <SubmitButton size="sm" pendingLabel="Saving…">
                      Save rule
                    </SubmitButton>
                    <ConfirmAction
                      action={deleteRouteAction}
                      values={{ id: r.id }}
                      title="Delete this routing rule?"
                      description="New complaints for this category will fall back to the default office until another rule matches."
                      confirmLabel="Delete"
                      variant="destructive"
                      trigger={
                        <Button type="button" variant="ghost" size="sm" className="text-destructive">
                          Delete rule
                        </Button>
                      }
                    />
                  </div>
                </form>
              </details>
            ))}
            {routes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No routing rules yet — complaints fall back to the coordination office.
              </p>
            ) : null}

            <form action={saveRouteAction} className="grid gap-3 border-t pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Add rule</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Category</Label>
                  <select
                    name="categoryKey"
                    defaultValue={activeCategories[0]?.key ?? ""}
                    className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Target role</Label>
                  <select
                    name="targetRole"
                    defaultValue="COORDINATOR"
                    className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Default priority</Label>
                  <select
                    name="defaultPriority"
                    defaultValue="MEDIUM"
                    className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Escalate after (hours)</Label>
                  <Input name="escalateAfterHours" type="number" min={1} max={720} placeholder="48" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Escalate to</Label>
                  <select
                    name="escalateToRole"
                    defaultValue="ADMIN"
                    className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                  >
                    <option value="">— none —</option>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Sort order</Label>
                  <Input name="sortOrder" type="number" min={0} max={999} defaultValue={routes.length + 1} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Status</Label>
                  <select
                    name="active"
                    defaultValue="1"
                    className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none"
                  >
                    <option value="1">Active</option>
                    <option value="0">Disabled</option>
                  </select>
                </div>
              </div>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Adding…" className="w-fit">
                <Plus className="h-3.5 w-3.5" />
                Add rule
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
