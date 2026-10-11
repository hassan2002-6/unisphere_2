import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { GraduationCap, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Deactivated accounts land here (spec §5 — deactivation actually blocks the portal). */
export default function AccountDisabledPage() {
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
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <UserX className="h-5.5 w-5.5" />
          </span>
          <div className="space-y-1.5">
            <CardTitle>Account deactivated</CardTitle>
            <CardDescription>
              This account has been deactivated and cannot access the portal. Records stay archived — nothing was
              deleted.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          <div className="rounded-lg border bg-muted/40 px-3.5 py-3">
            <p className="font-medium text-foreground">What to do next</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>Contact the coordination office or the administrator who deactivated the account.</li>
              <li>Once reactivated, sign in again — no new account is needed.</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <SignOutButton>
              <Button variant="secondary">Sign out</Button>
            </SignOutButton>
            <Button asChild variant="ghost">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
