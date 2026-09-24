import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Placeholder({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description?: string;
}) {
  return (
    <main className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            <Badge variant="secondary">{milestone}</Badge>
          </div>
          <CardDescription>
            {description ?? "This screen is scaffolded and lands in its milestone."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Route stubbed per the implementation plan (§6.4). Nothing to see yet — it will be
            built in milestone {milestone}.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
