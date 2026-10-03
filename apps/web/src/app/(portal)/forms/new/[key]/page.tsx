import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTemplateByKey } from "@/server/services/forms";
import { formFieldsSchema } from "@/lib/validation";
import { DynamicForm } from "@/components/dynamic-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/rbac";
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
    <>
      <PageHeader
        icon={FileText}
        breadcrumbs={[
          { label: "Forms Center", href: "/forms" },
          { label: template.title },
        ]}
        title={template.title}
        description={template.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Routed to {template.recipientLabel}</Badge>
            {template.slaDays ? <Badge variant="outline">SLA ~{template.slaDays} day(s)</Badge> : null}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/forms">
                <ArrowLeft className="h-4 w-4" />
                All forms
              </Link>
            </Button>
          </div>
        }
      />

      {!canSubmit ? (
        <Alert variant="warning">
          <AlertTitle>This form isn&apos;t available for your role</AlertTitle>
          <AlertDescription>
            It&apos;s designed for {ROLE_LABELS[template.audienceRole]} users. You can still browse the
            catalogue — pick a form addressed to your role.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          {canSubmit ? (
            <DynamicForm fields={fields.data} action={boundAction} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Submission is disabled for your role.{" "}
              <Link href="/forms" className="font-medium text-foreground underline underline-offset-2">
                Browse the Forms Center
              </Link>{" "}
              instead.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
