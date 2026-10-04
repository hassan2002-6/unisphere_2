import { SignIn } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

/**
 * The single sign-in page for every role — students, faculty, coordinators,
 * the FYP Head and mentors all authenticate here and land on their own
 * dashboard. Accounts are provisioned by the coordination office (no public
 * sign-up), so the sign-up footer action is hidden.
 */
export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        forceRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full max-w-md border border-border rounded-2xl shadow-none",
            card: "shadow-none rounded-2xl",
            footer: "hidden",
            footerAction: "hidden",
            headerTitle: "text-lg font-semibold",
            headerSubtitle: "text-muted-foreground",
          },
        }}
      />
      <div className="max-w-md space-y-2 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          One sign-in for every role — each lands on its own dashboard.
        </p>
        <p>
          Demo accounts for evaluation use <span className="font-medium text-foreground">@shu.edu.pk</span> addresses
          (student, faculty, coordinator, FYP Head and mentor personas).
        </p>
      </div>
    </AuthShell>
  );
}
