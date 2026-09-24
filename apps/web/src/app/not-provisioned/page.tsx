import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotProvisionedPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>
            Your sign-in worked, but this account has no UniSphere profile yet — and automatic
            provisioning is disabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Ask the FYP Head or coordinator to add your account, or sign in with a provisioned
            account.
          </p>
          <div className="flex gap-2">
            <SignOutButton>
              <Button variant="secondary">Sign out</Button>
            </SignOutButton>
            <Button asChild variant="ghost">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
