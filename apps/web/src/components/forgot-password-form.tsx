"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { ArrowLeft, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Forgot password (spec §4): Clerk's secure reset_password_email_code flow.
 * Step 1 request the code for the account's email, step 2 enter the code plus
 * a new password. Built on Clerk's custom-flow sign-in API.
 */

type Step = "request" | "reset" | "done";

function describeError(error: unknown): string {
  const e = error as { code?: string; longMessage?: string; message?: string } | null;
  const code = e?.code ?? "";
  if (code.includes("identifier_not_found")) return "No account uses that email address.";
  if (code.includes("too_many_requests")) return "Too many attempts — wait a minute and try again.";
  if (code.includes("incorrect")) return "That code is incorrect or expired — check it and try again.";
  return e?.longMessage || e?.message || "Something went wrong — try again.";
}

export function ForgotPasswordForm() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = pending || fetchStatus === "fetching";

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setPending(true);
    setError(null);
    try {
      const created = await signIn.create({ identifier: email.trim().toLowerCase() });
      if (created.error) {
        setError(describeError(created.error));
        return;
      }
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        setError(describeError(sent.error));
        return;
      }
      setStep("reset");
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (verified.error) {
        setError(describeError(verified.error));
        return;
      }
      if (signIn.status !== "needs_new_password") {
        setError("That code didn't work — check it and try again.");
        return;
      }
      const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (submitted.error) {
        setError(describeError(submitted.error));
        return;
      }
      // `status` narrows to the literal type — read it through a wider type.
      const finalStatus: string = signIn.status;
      if (finalStatus === "complete") {
        await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl("/dashboard");
            if (url.startsWith("http")) window.location.href = url;
            else router.push(url);
            router.refresh();
          },
        });
        return;
      }
      setStep("done");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-[28px] leading-none font-bold text-primary">
          <GraduationCap className="h-7 w-7" />
          UniSphere
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Password reset</p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[#f5c2c7] bg-[#f8d7da] px-3 py-2 text-[13px] text-[#721c24]"
        >
          {error}
        </div>
      )}

      {step === "request" && (
        <form onSubmit={requestCode} className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Enter your university email address. We&rsquo;ll send a 6-digit reset code to it.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-[#444444]">
              University email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@shu.edu.pk"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send reset code
          </Button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetPassword} className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            We emailed a code to <span className="font-medium text-foreground">{email}</span>.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-[13px] font-medium text-[#444444]">
              Reset code
            </label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-[13px] font-medium text-[#444444]">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-[13px] font-medium text-[#444444]">
              Confirm new password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Set new password
          </Button>
        </form>
      )}

      {step === "done" && <p className="text-center text-sm text-muted-foreground">Password updated. You can sign in now.</p>}

      <a
        href="/sign-in"
        className="mt-6 flex items-center justify-center gap-1 text-[13px] font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign-in
      </a>
    </div>
  );
}
