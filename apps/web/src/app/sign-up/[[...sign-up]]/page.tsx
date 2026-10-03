import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full max-w-md border border-border rounded-2xl shadow-none",
            card: "shadow-none rounded-2xl",
            footer: "bg-transparent",
            headerTitle: "text-lg font-semibold",
            headerSubtitle: "text-muted-foreground",
          },
        }}
      />
      <p className="max-w-md text-center text-xs text-muted-foreground">
        Accounts are provisioned by the coordination office — if your profile isn&apos;t linked yet you&apos;ll see a
        setup notice after signing up.
      </p>
    </AuthShell>
  );
}
