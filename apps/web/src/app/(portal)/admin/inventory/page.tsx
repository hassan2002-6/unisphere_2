import { requireCapability } from "@/lib/auth";
import { listResources } from "@/server/services/resources";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createResourceAction, updateResourceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  await requireCapability("resources.manage");

  let resources: Awaited<ReturnType<typeof listResources>> | null = null;
  try {
    resources = await listResources();
  } catch {
    resources = null;
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Compute inventory with live availability — allocations decrement <em>available</em> atomically.
        </p>
      </div>

      {resources === null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Resources ({resources.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resources yet — add the first one below.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Specs</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead className="text-right">Adjust</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((r) => {
                    const utilization = r.quantity > 0 ? Math.round(((r.quantity - r.available) / r.quantity) * 100) : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <span className="font-medium">{r.name}</span>{" "}
                          <span className="text-muted-foreground">— {r.model}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-56 text-xs text-muted-foreground">{r.specs}</TableCell>
                        <TableCell className="text-sm">
                          {r.available}/{r.quantity} free
                          <span className="ml-2 text-xs text-muted-foreground">({utilization}% in use)</span>
                        </TableCell>
                        <TableCell>
                          <form action={updateResourceAction} className="flex items-center justify-end gap-2">
                            <input type="hidden" name="id" value={r.id} />
                            <Input name="quantity" type="number" min={1} defaultValue={r.quantity} className="h-8 w-20" />
                            <Input name="available" type="number" min={0} defaultValue={r.available} className="h-8 w-20" />
                            <Button type="submit" variant="secondary" size="sm">
                              Save
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Add a resource</CardTitle>
          <CardDescription>New stock starts fully available.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createResourceAction} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="GPU Server 4" className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" required placeholder="RTX 4080" className="w-36" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue="GPU"
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="GPU">GPU</option>
                <option value="CPU">CPU</option>
                <option value="WORKSTATION">Workstation</option>
                <option value="LAB">Lab</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="specs">Specs</Label>
              <Input id="specs" name="specs" placeholder="16 GB, CUDA 12" className="w-44" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" min={1} required defaultValue={1} className="w-24" />
            </div>
            <Button type="submit">Add resource</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
