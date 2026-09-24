import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SetupNeededPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Database not connected</CardTitle>
          <CardDescription>
            UniSphere needs a PostgreSQL connection before the portal can resolve user accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            1. Create a free Neon project and copy the pooled + direct connection strings.
          </p>
          <p>
            2. Put them in <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> as{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">DATABASE_URL</code> and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">DIRECT_URL</code> (see{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code>).
          </p>
          <p>
            3. Run <code className="rounded bg-muted px-1.5 py-0.5">bunx prisma migrate dev</code> and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">bun run seed</code> in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">packages/db</code>.
          </p>
          <Button asChild variant="secondary">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
