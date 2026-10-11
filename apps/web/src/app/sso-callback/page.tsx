import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * OAuth return leg (spec §4 — optional Google sign-in). The verified Google
 * account is matched to a pre-provisioned university record by email; roles
 * are never granted from a Gmail address alone.
 */
export default function SsoCallbackPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-[#c8102e] to-[#9b0c23] p-5">
      <div className="w-full max-w-[400px] rounded-2xl bg-card p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/not-provisioned"
        />
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </div>
  );
}
