import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn
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
        Demo accounts for evaluation use{" "}
        <span className="font-medium text-foreground">@shu.edu.pk</span> addresses (student, faculty, coordinator, FYP
        Head and mentor personas).
      </p>
    </AuthShell>
  );
}
