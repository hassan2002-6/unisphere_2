import { Boxes } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { listResources } from "@/server/services/resources";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  if (!resources) {
    return (
      <>
        <PageHeader
          icon={Boxes}
          title="Inventory"
          description="Compute inventory with live availability — allocations decrement available atomically."
        />
        <Alert variant="destructive">
          <AlertTitle>Inventory unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Boxes}
        title="Inventory"
        description={
          <>
            Compute inventory with live availability — allocations decrement <em>available</em> atomically.
          </>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-3.5">
          <CardTitle className="text-sm font-semibold">Resources ({resources.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {resources.length === 0 ? (
            <div className="px-5 py-5">
              <EmptyState compact icon={Boxes} title="No resources yet" description="Add the first one below." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Resource</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Specs</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead className="pr-5 text-right">Adjust</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => {
                  const utilization = r.quantity > 0 ? Math.round(((r.quantity - r.available) / r.quantity) * 100) : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5">
                        <span className="font-medium">{r.name}</span>{" "}
                        <span className="text-muted-foreground">— {r.model}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-56 text-xs text-muted-foreground">{r.specs}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {r.available}/{r.quantity} free
                        <span className="ml-2 text-xs text-muted-foreground">({utilization}% in use)</span>
                      </TableCell>
                      <TableCell className="pr-5">
                        <form action={updateResourceAction} className="flex items-center justify-end gap-2">
                          <input type="hidden" name="id" value={r.id} />
                          <Input name="quantity" type="number" min={1} defaultValue={r.quantity} className="h-8 w-20" />
                          <Input name="available" type="number" min={0} defaultValue={r.available} className="h-8 w-20" />
                          <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
                            Save
                          </SubmitButton>
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

      <Card>
        <CardHeader className="py-3.5">
          <CardTitle className="text-sm font-semibold">Add a resource</CardTitle>
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
            <SubmitButton pendingLabel="Adding…">Add resource</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
