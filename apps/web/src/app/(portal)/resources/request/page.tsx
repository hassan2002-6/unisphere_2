import { Cpu, Server } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listResources } from "@/server/services/resources";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createResourceRequestAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RequestResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  let resources: Awaited<ReturnType<typeof listResources>> = [];
  try {
    resources = await listResources();
  } catch {
    resources = [];
  }

  return (
    <>
      <PageHeader
        icon={Cpu}
        title="Request GPU / Lab Resources"
        description="FYP and course projects can request compute resources — the FYP Head reviews and allocates."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request not submitted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Request details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createResourceRequestAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="projectName">
                    Project name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="projectName" name="projectName" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="groupName">Group name</Label>
                  <Input id="groupName" name="groupName" required />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="members">Members</Label>
                <Input id="members" name="members" placeholder="Ali Raza (23-0001), …" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="resourceType">Resource type</Label>
                  <select
                    id="resourceType"
                    name="resourceType"
                    defaultValue="GPU"
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="GPU">GPU</option>
                    <option value="CPU">CPU</option>
                    <option value="WORKSTATION">Workstation</option>
                    <option value="LAB">Lab</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="config">
                    Configuration <span className="text-destructive">*</span>
                  </Label>
                  <Input id="config" name="config" placeholder="RTX 4090 — 24 GB" required list="resource-models" />
                  <datalist id="resource-models">
                    {resources.map((r) => (
                      <option key={r.id} value={r.model} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="supervisor">Supervisor</Label>
                  <Input id="supervisor" name="supervisor" placeholder="Optional" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="startDate">
                    Start date <span className="text-destructive">*</span>
                  </Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="endDate">
                    End date <span className="text-destructive">*</span>
                  </Label>
                  <Input id="endDate" name="endDate" type="date" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="timeSlot">
                    Time slot <span className="text-destructive">*</span>
                  </Label>
                  <Input id="timeSlot" name="timeSlot" placeholder="Evenings 18:00–22:00" required />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="purpose">
                  Purpose <span className="text-destructive">*</span>
                </Label>
                <Textarea id="purpose" name="purpose" rows={4} required minLength={10} maxLength={2000} />
              </div>
              <SubmitButton className="w-fit" pendingLabel="Submitting…">
                Submit request
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-muted-foreground" />
              Available inventory
            </CardTitle>
            <CardDescription>Live availability from the lab inventory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.length === 0 ? (
              <EmptyState
                compact
                icon={Server}
                title="Inventory unavailable"
                description="Live availability appears here once the lab inventory answers."
              />
            ) : (
              resources.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    <span className="font-medium">{r.model}</span>{" "}
                    <span className="text-muted-foreground">· {r.specs}</span>
                  </span>
                  <Badge variant={r.available > 0 ? "secondary" : "outline"} className="shrink-0">
                    {r.available}/{r.quantity}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
