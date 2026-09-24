import { requireCapability } from "@/lib/auth";
import { listLabs } from "@/server/services/resources";
import { Button } from "@/components/ui/button";
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

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Labs &amp; Resources</h1>
        <p className="text-sm text-muted-foreground">
          The physical space inventory — labs hold the workstations students are allocated into.
        </p>
      </div>

      {labs === null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Labs unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Lab inventory ({labs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {labs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No labs yet — add the first one below.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lab</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <span className="font-medium">Lab {l.number}</span>{" "}
                        <span className="text-muted-foreground">— {l.name}</span>
                      </TableCell>
                      <TableCell className="text-sm">{l.type ?? "—"}</TableCell>
                      <TableCell className="text-sm">{l.capacity}</TableCell>
                      <TableCell>
                        <form action={updateLabAction} className="flex items-center justify-end gap-2">
                          <input type="hidden" name="id" value={l.id} />
                          <Input name="capacity" type="number" min={1} defaultValue={l.capacity} className="h-8 w-20" />
                          <Input name="type" defaultValue={l.type ?? ""} placeholder="Type" className="h-8 w-28" />
                          <Button type="submit" variant="secondary" size="sm">
                            Save
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Add a lab</CardTitle>
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
            <Button type="submit">Add lab</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
