import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMPLAINT_CATEGORIES } from "@/server/services/complaints";
import { createComplaintAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">File a complaint</h1>
        <p className="text-sm text-muted-foreground">
          Complaints are routed by category — faculty complaints reach faculty and the coordination office.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Complaint details</CardTitle>
          <CardDescription>Be specific — vague complaints take longer to resolve.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createComplaintAction} className="grid max-w-xl gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="subject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input id="subject" name="subject" required minLength={4} maxLength={150} placeholder="Short summary" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                defaultValue="Facilities"
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                required
                minLength={10}
                maxLength={4000}
                rows={6}
                placeholder="What happened, where, when — and what outcome you need."
              />
            </div>
            <Button type="submit" className="w-fit">
              Submit complaint
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
