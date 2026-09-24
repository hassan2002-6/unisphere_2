import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTemplateByKey } from "@/server/services/forms";
import { formFieldsSchema } from "@/lib/validation";
import { DynamicForm } from "@/components/dynamic-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitFormAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SubmitFormPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  const { key } = await params;

  let template: Awaited<ReturnType<typeof getTemplateByKey>> | null = null;
  try {
    template = await getTemplateByKey(key);
  } catch {
    template = null;
  }
  if (!template) notFound();

  const fields = formFieldsSchema.safeParse(template.fields);
  if (!fields.success) notFound();

  const canSubmit = template.audienceRole === user.role;
  const boundAction = submitFormAction.bind(null, template.key, fields.data);

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{template.title}</h1>
        <p className="text-sm text-muted-foreground">{template.description}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">→ {template.recipientLabel}</Badge>
          {template.slaDays ? <Badge variant="outline">SLA ~{template.slaDays} days</Badge> : null}
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Submission details</CardTitle>
          {!canSubmit ? (
            <CardDescription className="text-destructive">
              This form is for {template.audienceRole.toLowerCase()} users — you cannot submit it with your current
              role.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {canSubmit ? <DynamicForm fields={fields.data} action={boundAction} /> : null}
        </CardContent>
      </Card>
    </main>
  );
}
