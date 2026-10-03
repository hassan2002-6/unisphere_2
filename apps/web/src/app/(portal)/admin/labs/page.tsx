import { FlaskConical } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listLabs } from "@/server/services/resources";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createLabAction, updateLabAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLabsPage() {
  await requireCapability("resources.manage");

  let labs: Awaited<ReturnType<typeof listLabs>> | null = null;
  try {
    labs = await listLabs();
  } catch {
    labs = null;
  }

  if (!labs) {
    return (
      <>
        <PageHeader
          icon={FlaskConical}
          title="Labs & Resources"
          description="The physical space inventory — labs hold the workstations students are allocated into."
        />
        <Alert variant="destructive">
          <AlertTitle>Labs unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={FlaskConical}
        title="Labs & Resources"
        description="The physical space inventory — labs hold the workstations students are allocated into."
      />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="text-sm font-semibold">Lab inventory ({labs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {labs.length === 0 ? (
            <div className="px-5 py-5">
              <EmptyState compact icon={FlaskConical} title="No labs yet" description="Add the first one below." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Lab</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="pr-5 text-right">Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-5">
                      <span className="font-medium">Lab {l.number}</span>{" "}
                      <span className="text-muted-foreground">— {l.name}</span>
                    </TableCell>
                    <TableCell className="text-sm">{l.type ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{l.capacity}</TableCell>
                    <TableCell className="pr-5">
                      <form action={updateLabAction} className="flex items-center justify-end gap-2">
                        <input type="hidden" name="id" value={l.id} />
                        <Input name="capacity" type="number" min={1} defaultValue={l.capacity} className="h-8 w-20" />
                        <Input name="type" defaultValue={l.type ?? ""} placeholder="Type" className="h-8 w-28" />
                        <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
                          Save
                        </SubmitButton>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="text-sm font-semibold">Add a lab</CardTitle>
          <CardDescription>Number must be unique (e.g. GL-2).</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createLabAction} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="number">Number</Label>
              <Input id="number" name="number" required placeholder="GL-2" className="w-28" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="General Lab 2" className="w-44" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" min={1} required defaultValue={30} className="w-24" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Input id="type" name="type" placeholder="General / GPU / Networks" className="w-40" />
            </div>
            <SubmitButton pendingLabel="Adding…">Add lab</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
