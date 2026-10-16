import { FileText, MessageSquarePlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { ComplaintRecipientsPicker } from "@/components/complaint-recipients-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listActiveCategories, listComplaintHandlers } from "@/server/services/complaints";
import { classesForComplaint } from "@/server/services/assignments";
import { createComplaintAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  const [categories, courses, staff] = await Promise.all([
    listActiveCategories(),
    user.role === "STUDENT" ? classesForComplaint(user) : Promise.resolve([]),
    listComplaintHandlers(),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Complaint Box", href: "/complaints" }, { label: "File a complaint" }]}
        icon={MessageSquarePlus}
        title="File a complaint"
        description="Your complaint is assigned a reference number and routed to the responsible office by the coordination rules."
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
          <CardDescription>
            Be specific — vague complaints take longer to resolve. Priority is set by the university routing rules.
          </CardDescription>
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
                defaultValue={categories[0]?.key ?? "Other"}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {courses.length > 0 ? (
              <div className="grid gap-1.5">
                <Label htmlFor="classId">Related course (optional)</Label>
                <select
                  id="classId"
                  name="classId"
                  defaultValue=""
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Not course-specific</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode} — {c.title} ({c.section})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                required
                minLength={10}
                maxLength={6000}
                rows={6}
                placeholder="What happened, where, when — and what outcome you need."
              />
            </div>
            {staff.length > 0 ? <ComplaintRecipientsPicker staff={staff} /> : null}
            <div className="grid gap-1.5">
              <Label htmlFor="attachment">Attachment (optional, max 2 MB — pdf, docx, png, jpg…)</Label>
              <Input
                id="attachment"
                name="attachment"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.csv,.zip"
                className="h-9 py-1.5"
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
