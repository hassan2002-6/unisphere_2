import { FileText, MessageSquarePlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    <>
      <PageHeader
        breadcrumbs={[{ label: "Complaint Box", href: "/complaints" }, { label: "File a complaint" }]}
        icon={MessageSquarePlus}
        title="File a complaint"
        description="Complaints are routed by category — faculty complaints reach faculty and the coordination office."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Complaint not filed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="max-w-2xl">
        <CardHeader className="py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Complaint details
          </CardTitle>
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
            <SubmitButton pendingLabel="Submitting…" className="w-fit">
              Submit complaint
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
