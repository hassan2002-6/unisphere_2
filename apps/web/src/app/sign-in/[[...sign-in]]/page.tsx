import { SignIn } from "@clerk/nextjs";
import { GraduationCap } from "lucide-react";

/**
 * The single sign-in page for every role — students, faculty, coordinators,
 * the FYP Head, mentors and admins all authenticate here and land on their own
 * dashboard. Styled as the setup2.html prototype's login screen: crimson
 * gradient backdrop with a centred white card. Accounts are provisioned by the
 * coordination office (no public sign-up), so the sign-up footer is hidden.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-[#c8102e] to-[#9b0c23] p-5">
      <div className="w-full max-w-[400px] rounded-2xl bg-card p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="mb-6 text-center">
          <h1 className="flex items-center justify-center gap-2 text-[32px] leading-none font-bold text-primary">
            <GraduationCap className="h-8 w-8" />
            UniSphere
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Centralized University Platform</p>
        </div>
        <h2 className="mb-5 text-center text-xl font-semibold">Welcome Back</h2>
        <SignIn
          forceRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
              card: "shadow-none border-0 bg-transparent p-0 gap-4",
              header: "hidden",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              formFieldLabel: "text-[13px] font-medium text-[#444444]",
              formFieldInput:
                "h-auto rounded-lg border-border px-[14px] py-[11px] text-sm focus:border-primary focus:ring-3 focus:ring-[rgba(200,16,46,0.15)]",
              formButtonPrimary:
                "h-auto rounded-lg bg-primary px-5 py-[11px] text-sm font-semibold normal-case shadow-none hover:bg-[#9b0c23]",
              footer: "hidden",
              footerAction: "hidden",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground",
            },
          }}
        />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          One sign-in for every role — each lands on its own dashboard.
          <br />
          Demo accounts use <span className="font-medium text-foreground">@shu.edu.pk</span> addresses.
        </p>
      </div>
    </div>
  );
}
