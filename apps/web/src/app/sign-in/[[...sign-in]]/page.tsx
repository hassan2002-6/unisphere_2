import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { ShuLogo } from "@/components/shu-logo";

/**
 * The single sign-in page for every role — students, faculty, coordinators,
 * the FYP Head and admins all authenticate here and land on their own
 * dashboard.
 *
 * Lightweight SHU-branded layout: red/white/neutral, the university name and
 * the portal descriptor, and a university-logo slot (authorized asset at
 * `public/branding/shu-logo.png`, otherwise a clearly replaceable placeholder).
 * Accepts a University ID (S22CSC003, FAC001, …) or an email, a password with
 * show/hide, Forgot-password, optional Google SSO and admin-issued single-use
 * recovery tickets (?ticket=…).
 */

export const metadata: Metadata = {
  title: { absolute: "Sign in · UniSphere — Salim Habib University" },
  description: "Sign in to UniSphere — the Salim Habib University student support and management portal.",
};

/**
 * Development-only demo roster — roles and University IDs only. Passwords are
 * never rendered here (or anywhere in the app); this block does not exist in
 * production builds. Provision the roster with the seed + link scripts
 * (see DEMO-LOGIN.md at the repository root).
 */
const DEV_DEMO_ACCOUNTS = [
  { role: "Student", id: "S22CSC001", email: "student@shu.edu.pk" },
  { role: "Faculty", id: "FAC001", email: "faculty@shu.edu.pk" },
  { role: "Course Coordinator", id: "COORD001", email: "coordinator@shu.edu.pk" },
  { role: "FYP Head", id: "FYP001", email: "fyphead@shu.edu.pk" },
  { role: "Admin", id: "ADMIN001", email: "admin@shu.edu.pk" },
] as const;

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f6f6f6] px-4 py-8 sm:py-12 dark:bg-background">
      <main className="w-full max-w-[420px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div aria-hidden className="h-1 w-full bg-primary" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <ShuLogo />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Salim Habib University</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">UniSphere — Student Support &amp; Management Portal</p>
            </div>

            <div aria-hidden className="my-6 h-px w-full bg-border" />

            <Suspense fallback={<div className="h-72" />}>
              <SignInForm />
            </Suspense>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Accounts are issued by the university&apos;s coordination office.
        </p>
      </main>

      {process.env.NODE_ENV === "development" ? (
        <section
          aria-label="Demo accounts (development only)"
          className="mt-8 w-full max-w-[420px] rounded-2xl border border-dashed border-border bg-card p-5"
        >
          <h2 className="text-[13px] font-semibold text-foreground">Demo accounts — development only</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This list is hidden in production builds, and passwords are never shown here. Provision the roster with{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">bun run seed</code> +{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">bun run scripts/link-clerk-users.ts</code> (see DEMO-LOGIN.md).
          </p>
          <ul className="mt-3 divide-y">
            {DEV_DEMO_ACCOUNTS.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="font-medium">{account.role}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {account.id} · {account.email}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
