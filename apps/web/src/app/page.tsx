import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Briefcase,
  CalendarDays,
  FileText,
  GraduationCap,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Timetable & exam clashes",
    body: "Live clash detection across rooms, labs, faculty and cohorts — flagged the moment a clash appears, with a resolution queue for coordinators.",
  },
  {
    icon: FileText,
    title: "Forms Center",
    body: "Leave applications, certificates, NOCs and more — submitted once, reviewed with remarks, tracked from submission to decision.",
  },
  {
    icon: MessageSquareWarning,
    title: "Complaint Box",
    body: "Facilities, faculty or timetable complaints with a full event trail and automatic notifications at every status change.",
  },
  {
    icon: Briefcase,
    title: "Internships",
    body: "Verified postings from partner companies; apply in one click and track shortlists and offers from your dashboard.",
  },
  {
    icon: Users,
    title: "Alumni mentorship",
    body: "Request a mentor, schedule sessions and get guidance on projects and careers — interest from ~70% of surveyed students.",
  },
  {
    icon: Sparkles,
    title: "AI assistant",
    body: "Ask about your timetable, deadlines or policies. Answers are grounded in the university knowledge base and cite their sources.",
  },
  {
    icon: BarChart3,
    title: "FYP & GPU allocation",
    body: "FYP proposals, supervisor decisions, and a concurrency-safe GPU/lab allocation workflow — the last unit can only go to one project.",
  },
  {
    icon: BellRing,
    title: "Notifications & broadcast",
    body: "Role-targeted announcements and per-user alerts: never miss a decision, approval or schedule change again.",
  },
] as const;

const ROLES = [
  { role: "Students", line: "Timetable, forms, complaints, FYP, resources, internships & mentorship" },
  { role: "Faculty", line: "Teaching schedule, review queues and student complaints" },
  { role: "Coordinators", line: "Clash monitor, approvals, faculty directory and broadcasts" },
  { role: "FYP Head", line: "Proposals, resource requests, allocations, labs, inventory and reports" },
  { role: "Mentors", line: "Mentee requests, sessions and guidance tracking" },
] as const;

/** Tiny CSS mock of the portal UI used in the hero. */
function AppPreview() {
  return (
    <div className="relative w-full max-w-xl rounded-2xl border bg-card p-2 shadow-2xl shadow-primary/10 ring-1 ring-foreground/5">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <span className="ml-3 h-4 flex-1 rounded-full bg-muted" />
      </div>
      <div className="flex gap-2 rounded-xl bg-muted/40 p-2">
        <div className="hidden w-36 shrink-0 flex-col gap-1.5 rounded-lg bg-sidebar p-2.5 sm:flex">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-md bg-sidebar-primary" />
            <span className="h-2 w-16 rounded-full bg-sidebar-accent" />
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-md px-1.5 py-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-sidebar-accent" />
              <span className={i === 1 ? "h-2 w-16 rounded-full bg-sidebar-primary" : "h-2 w-14 rounded-full bg-sidebar-accent/70"} />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-2 p-1">
          <div className="flex items-center justify-between">
            <span className="h-3 w-28 rounded-full bg-foreground/15" />
            <span className="h-6 w-6 rounded-full bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["bg-primary/15", "bg-warning/20", "bg-success/20", "bg-info/15"].map((c) => (
              <div key={c} className="rounded-lg border bg-card p-2">
                <span className={`mb-2 block h-6 w-6 rounded-md ${c}`} />
                <span className="mb-1 block h-2.5 w-10 rounded-full bg-foreground/20" />
                <span className="block h-2 w-14 rounded-full bg-muted-foreground/25" />
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <div className="space-y-2 rounded-lg border bg-card p-2.5 sm:col-span-3">
              <span className="block h-2.5 w-24 rounded-full bg-foreground/15" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1.5">
                  <span className="h-2 w-20 rounded-full bg-foreground/15" />
                  <span className={`h-3.5 w-12 rounded-full ${i === 0 ? "bg-warning/30" : "bg-success/25"}`} />
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border bg-card p-2.5 sm:col-span-2">
              <span className="block h-2.5 w-16 rounded-full bg-foreground/15" />
              <span className="block h-16 rounded-md bg-gradient-to-br from-primary/15 to-info/10" />
              <span className="block h-2 w-20 rounded-full bg-muted-foreground/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">UniSphere</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#roles" className="transition-colors hover:text-foreground">Roles</a>
            <a href="#trust" className="transition-colors hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Show when="signed-out">
              <Button asChild>
                <Link href="/sign-in">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Show>
            <Show when="signed-in">
              <Button variant="outline" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 max-w-4xl rounded-full bg-primary/10 blur-3xl"
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div className="space-y-7">
              <Badge variant="outline" className="gap-1.5 border-primary/25 bg-primary/5 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                FYP-II 2026 · Salim Habib University
              </Badge>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
                Everything campus,{" "}
                <span className="text-gradient">one portal.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                UniSphere replaces scattered notice boards, email threads and paper forms with a
                single role-aware portal — timetable and exam clashes, requests, complaints,
                internships, mentorship and resource allocation, with an AI assistant that cites
                its sources.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {userId ? (
                  <Button size="lg" asChild>
                    <Link href="/dashboard">
                      Open dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" asChild>
                      <Link href="/sign-in">
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="#features">See what&apos;s inside</Link>
                    </Button>
                  </>
                )}
              </div>
              <dl className="grid max-w-lg grid-cols-3 gap-4 border-t pt-6 text-sm">
                <div>
                  <dt className="text-muted-foreground">Surveyed students</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums">74</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Would use UniSphere</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums">71.6%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Want alumni mentorship</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums">~70%</dd>
                </div>
              </dl>
            </div>
            <div className="flex justify-center lg:justify-end">
              <AppPreview />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t bg-card/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Built around the problems students reported</h2>
              <p className="mt-3 text-muted-foreground">
                Every module in UniSphere traces back to the FYP-I survey — clash pain points,
                slow paper processes and career support — and to the university&rsquo;s day-to-day
                workflows.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <Card key={f.title} className="card-lift gap-3 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-20">
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold tracking-tight">One portal, five roles</h2>
              <p className="text-muted-foreground">
                Every role signs in through the same page and lands on its own dashboard — students,
                faculty, coordinators, the FYP Head and mentors each see exactly what they need,
                nothing more. Navigation, permissions and server-side checks are driven by a single
                RBAC matrix, so sensitive screens stay out of reach by design.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {["Student", "Faculty", "Coordinator", "FYP Head", "Mentor"].map((r) => (
                  <Badge key={r} variant="secondary" className="px-3 py-1 text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              {ROLES.map((r) => (
                <div
                  key={r.role}
                  className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/30"
                >
                  <div>
                    <p className="font-medium">{r.role}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{r.line}</p>
                  </div>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust / how it works */}
        <section id="trust" className="border-t bg-card/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Secure by design",
                  body: "Clerk authentication, server-side authorization on every page and action, and a static guard scan that fails the build if a route ships without an access check.",
                },
                {
                  icon: CalendarDays,
                  title: "Live, not stale",
                  body: "Schedules, queues and allocations are computed from one source of truth — when a coordinator resolves a clash, everyone's timetable updates.",
                },
                {
                  icon: BarChart3,
                  title: "Measurable",
                  body: "Reports and CSV exports for request volume, allocation usage and review turnaround, so the department can see what's improving.",
                },
              ].map((item) => (
                <div key={item.title} className="space-y-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-border">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
              Ready when the semester starts.
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Sign in with your university account to see your timetable, requests and everything
              else in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {userId ? (
                <Button size="lg" asChild>
                  <Link href="/dashboard">
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild>
                  <Link href="/sign-in">
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>UniSphere — Salim Habib University</span>
          </div>
          <p>Team: Ishan Rajwani · Carol Swan · M. Hassan Siddiqui</p>
        </div>
      </footer>
    </div>
  );
}
