import Link from "next/link";
import { ArrowRight, ClipboardList, FileText, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTemplatesFor } from "@/server/services/forms";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FormsCenterPage() {
  const user = await requireUser();

  let templates: Awaited<ReturnType<typeof listTemplatesFor>> | null = null;
  try {
    templates = await listTemplatesFor(user.role);
  } catch (error) {
    console.error("forms center load failed:", error);
    templates = null;
  }

  return (
    <>
      <PageHeader
        icon={FileText}
        title="Forms Center"
        description="Digital requests routed to the right office — submitted once, reviewed with remarks, tracked end-to-end."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/submissions">
              <ClipboardList className="h-4 w-4" />
              My submissions
            </Link>
          </Button>
        }
      />

      {templates === null ? (
        <Alert variant="destructive">
          <AlertTitle>Forms Center unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms available for your role"
          description="The catalogue is managed by the coordination office. New forms appear here as soon as they're published."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="card-lift flex flex-col justify-between gap-4 p-5">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  {t.slaDays ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      <Timer className="h-3 w-3" />
                      ~{t.slaDays} day{t.slaDays === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h2 className="font-semibold tracking-tight">{t.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="max-w-[60%] truncate">
                  {t.recipientLabel}
                </Badge>
                <Button size="sm" asChild>
                  <Link href={`/forms/new/${t.key}`}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
