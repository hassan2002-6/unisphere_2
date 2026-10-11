"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { resolveLoginIdentifierAction } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * One sign-in for every role (spec §4). Accepts a University ID (S22CSC003,
 * FAC001, COORD001, FYP001, ADMIN001) or an email address, shows/hides the
 * password, supports Forgot-password (Clerk email code), optional Google SSO
 * and single-use recovery tickets minted by an administrator.
 *
 * Built on Clerk's custom-flow sign-in API: every call returns { error }, and
 * a completed attempt is turned into a session with signIn.finalize().
 */

type Mfa = { strategy: "email_code" | "totp" | "phone_code"; hint: string };

function codeOf(error: unknown): string {
  return (error as { code?: string } | null)?.code ?? "";
}

function textOf(error: unknown): string {
  const e = error as { longMessage?: string; message?: string } | null;
  return e?.longMessage || e?.message || "Sign-in failed. Please try again.";
}

function describeError(error: unknown): string {
  const code = codeOf(error);
  if (code.includes("identifier_not_found"))
    return "We couldn't find that University ID or email address. Check the ID with the coordination office.";
  if (code.includes("password_incorrect"))
    return "That password is incorrect. Use “Forgot password” if you need it reset.";
  if (code.includes("too_many_requests")) return "Too many attempts — wait a minute and try again.";
  if (code.includes("banned")) return "This account is deactivated. Contact the coordination office.";
  return textOf(error);
}

export function SignInForm() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const params = useSearchParams();
  // Admin-issued recovery links use ?ticket=…; Clerk's hosted flows (and our
  // capture tooling) use the native ?__clerk_ticket=… — accept both.
  const ticket = params.get("ticket") ?? params.get("__clerk_ticket");
  const redirectTo = params.get("redirect_url");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [ticketPending, setTicketPending] = useState(Boolean(ticket));
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<Mfa | null>(null);
  const [code, setCode] = useState("");
  const ticketRan = useRef(false);

  async function finish() {
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        // Honour ?redirect_url= (set by the middleware when a signed-out user
        // was bounced off a deep link) — local paths only, never off-site.
        const target = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
        const url = decorateUrl(target);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
        router.refresh();
      },
    });
  }

  // Admin-issued single-use recovery ticket (?ticket=…): sign straight in.
  useEffect(() => {
    if (!ticket || !signIn || ticketRan.current) return;
    ticketRan.current = true;
    (async () => {
      const res = await signIn.ticket({ ticket });
      if (res.error) {
        setError("This recovery link is invalid or has expired — ask your administrator for a fresh one.");
      } else if (signIn.status === "complete") {
        await finish();
        return;
      } else {
        setError("This recovery link is no longer valid — ask your administrator for a fresh one.");
      }
      setTicketPending(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, signIn]);

  async function startMfaIfNeeded(): Promise<boolean> {
    if (signIn.status !== "needs_second_factor" && signIn.status !== "needs_client_trust") return false;
    const strategies = (signIn.supportedSecondFactors ?? []).map((f) => f.strategy);
    if (strategies.includes("email_code")) {
      const send = await signIn.mfa.sendEmailCode();
      if (!send.error) {
        setMfa({ strategy: "email_code", hint: "We emailed you a 6-digit verification code." });
        return true;
      }
    }
    if (strategies.includes("totp")) {
      setMfa({ strategy: "totp", hint: "Enter the code from your authenticator app." });
      return true;
    }
    if (strategies.includes("phone_code")) {
      const send = await signIn.mfa.sendPhoneCode();
      if (!send.error) {
        setMfa({ strategy: "phone_code", hint: "We sent a 6-digit code to your phone." });
        return true;
      }
    }
    setError("This account needs a second verification step that isn't available here. Contact the coordination office.");
    return true;
  }

  async function resolveIdentifier(value: string): Promise<string | null> {
    if (value.includes("@")) return value;
    const match = await resolveLoginIdentifierAction(value);
    return match?.email ?? null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setPending(true);
    setError(null);
    try {
      const loginId = await resolveIdentifier(identifier.trim());
      if (!loginId) {
        setError("We couldn't find that University ID. Example format: S22CSC001, FAC001, COORD001.");
        return;
      }
      const res = await signIn.password({ identifier: loginId, password });
      if (res.error) {
        setError(describeError(res.error));
        return;
      }
      if (signIn.status === "complete") {
        await finish();
        return;
      }
      if (await startMfaIfNeeded()) return;
      if (signIn.status === "needs_first_factor") {
        setError("Additional verification is required — try signing in with your email address instead.");
        return;
      }
      setError("Sign-in couldn't be completed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || !mfa) return;
    setPending(true);
    setError(null);
    try {
      const res =
        mfa.strategy === "email_code"
          ? await signIn.mfa.verifyEmailCode({ code })
          : mfa.strategy === "totp"
            ? await signIn.mfa.verifyTOTP({ code })
            : await signIn.mfa.verifyPhoneCode({ code });
      if (res.error) {
        setError(describeError(res.error));
        return;
      }
      if (signIn.status === "complete") {
        await finish();
        return;
      }
      setError("That code didn't complete the sign-in — try again.");
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    if (!signIn) return;
    setError(null);
    const res = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/dashboard",
      redirectCallbackUrl: "/sso-callback",
    });
    if (res.error) {
      setError(
        "Google sign-in isn't enabled on this Clerk instance yet. An administrator can enable it under SSO connections in the Clerk dashboard.",
      );
    }
  }

  const busy = pending || fetchStatus === "fetching";

  if (ticketPending) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Checking your recovery link…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-[32px] leading-none font-bold text-primary">
          <GraduationCap className="h-8 w-8" />
          UniSphere
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Centralized University Platform</p>
      </div>
      <h2 className="mb-5 text-center text-xl font-semibold">Welcome Back</h2>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[#f5c2c7] bg-[#f8d7da] px-3 py-2 text-[13px] text-[#721c24]"
        >
          {error}
        </div>
      )}

      {mfa ? (
        <form onSubmit={onVerify} className="space-y-4">
          <p className="text-[13px] text-muted-foreground">{mfa.hint}</p>
          <div className="space-y-1.5">
            <label htmlFor="otp" className="text-[13px] font-medium text-[#444444]">
              Verification code
            </label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify &amp; continue
          </Button>
          <button
            type="button"
            className="w-full text-center text-[13px] text-primary hover:underline"
            onClick={() => {
              setMfa(null);
              setCode("");
            }}
          >
            Back to sign-in
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-[13px] font-medium text-[#444444]">
                University ID or email
              </label>
              <Input
                id="identifier"
                name="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="S22CSC001 — or you@shu.edu.pk"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-[#444444]">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <a href="/forgot-password" className="font-medium text-primary hover:underline">
                Forgot password?
              </a>
              <span className="text-muted-foreground">Accounts are issued by the university</span>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">or continue with</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
            <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2a7 7 0 0 1-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
              />
              <path fill="#FBBC05" d="M5.4 14.5a7.2 7.2 0 0 1 0-4.6V6.8H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.8l4 3.1A7 7 0 0 1 12 4.8Z"
              />
            </svg>
            Sign in with Google
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        One sign-in for every role — each lands on its own dashboard.
        <br />
        Demo accounts use <span className="font-medium text-foreground">@shu.edu.pk</span> addresses or the IDs above.
      </p>
    </div>
  );
}
