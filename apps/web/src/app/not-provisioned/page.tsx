import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { GraduationCap, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotProvisionedPage() {
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
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <ShieldAlert className="h-5.5 w-5.5" />
          </span>
          <div className="space-y-1.5">
            <CardTitle>Account not provisioned</CardTitle>
            <CardDescription>
              Your sign-in worked, but this account has no UniSphere profile yet — and automatic provisioning is
              disabled.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-muted-foreground">
          <div className="rounded-lg border bg-muted/40 px-3.5 py-3">
            <p className="font-medium text-foreground">What to do next</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>Ask the FYP Head or coordination office to add your account.</li>
              <li>Or sign in with a provisioned university account.</li>
              <li>Demo personas use <span className="font-medium text-foreground">@shu.edu.pk</span> addresses.</li>
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
