import Link from "next/link";
import { GraduationCap } from "lucide-react";

/**
 * Split-screen frame for the auth routes: brand + value props on the left,
 * Clerk form on the right. Mobile shows just the form with a compact header.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sidebar-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-info/10 blur-3xl"
        />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-sidebar-accent-foreground">
            UniSphere
          </span>
        </Link>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
            Everything campus,{" "}
            <span className="text-sidebar-primary">one sign-in away.</span>
          </h2>
          <ul className="space-y-3 text-sm text-sidebar-foreground/85">
            {[
              "Timetable & exam clashes flagged the moment they appear",
              "Forms, complaints, FYP applications and GPU requests — tracked end-to-end",
              "Internships, alumni mentorship and an AI assistant that cites its sources",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/60">
          Salim Habib University · Department of Computer Science · FYP-II 2026
        </p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-8">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">UniSphere</span>
        </Link>
        {children}
      </main>
    </div>
  );
}
