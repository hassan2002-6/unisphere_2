import Link from "next/link";
import { DatabaseZap, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetupNeededPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">UniSphere</span>
      </Link>

      <Card className="w-full max-w-lg">
        <CardHeader className="gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info">
            <DatabaseZap className="h-5.5 w-5.5" />
          </span>
          <div className="space-y-1.5">
            <CardTitle>Database not connected</CardTitle>
            <CardDescription>
              UniSphere needs a PostgreSQL connection before the portal can resolve user accounts.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          <ol className="space-y-2.5">
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                1
              </span>
              <span>
                Create a free Neon project and copy the pooled + direct connection strings.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                2
              </span>
              <span>
                Put them in <code className="rounded bg-muted px-1.5 py-0.5">apps/web/.env.local</code> as{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">DATABASE_URL</code> and{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">DIRECT_URL</code> (see{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code>).
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                3
              </span>
              <span>
                Run <code className="rounded bg-muted px-1.5 py-0.5">bunx prisma migrate deploy</code> and{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">bun run seed</code> in{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">packages/db</code>.
              </span>
            </li>
          </ol>
          <Button asChild variant="secondary">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
