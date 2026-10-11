import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";

/**
 * The single sign-in page for every role — students, faculty, coordinators,
 * the FYP Head, mentors and admins all authenticate here and land on their own
 * dashboard. Styled as the setup2.html prototype's login screen: crimson
 * gradient backdrop with a centred white card.
 *
 * Accepts a University ID (S22CSC003, FAC001, …) or an email, a password with
 * show/hide, Forgot-password, optional Google SSO and admin-issued
 * single-use recovery tickets (?ticket=…).
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-[#c8102e] to-[#9b0c23] p-5">
      <div className="w-full max-w-[400px] rounded-2xl bg-card p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <Suspense fallback={<div className="h-72" />}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
