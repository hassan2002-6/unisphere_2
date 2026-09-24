import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listTemplatesFor } from "@/server/services/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function FormsCenterPage() {
  const user = await requireUser();

  let templates: Awaited<ReturnType<typeof listTemplatesFor>> | null = null;
  try {
    templates = await listTemplatesFor(user.role);
  } catch {
    templates = null;
  }

  if (!templates) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forms Center unavailable</CardTitle>
            <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forms Center</h1>
        <p className="text-sm text-muted-foreground">
          Digital requests routed to the right office — no paper, tracked end-to-end.
        </p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No forms available for your role</CardTitle>
            <CardDescription>Check back later — the catalogue is managed by the coordination office.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{t.title}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary">{t.recipientLabel}</Badge>
                  {t.slaDays ? <span>SLA ~{t.slaDays}d</span> : null}
                </div>
                <Button asChild size="sm">
                  <Link href={`/forms/new/${t.key}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
