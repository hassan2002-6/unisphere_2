import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Cpu,
  FlaskConical,
  Megaphone,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard, type DashboardPanel, type DashboardStat } from "@/server/services/dashboard";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@unisphere/db";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS: Record<Role, { label: string; href: string; icon: typeof BookOpen }[]> = {
  STUDENT: [
    { label: "Submit a form", href: "/forms", icon: ClipboardList },
    { label: "Request GPU / lab", href: "/resources/request", icon: Cpu },
    { label: "Ask the assistant", href: "/chat", icon: Sparkles },
  ],
  FACULTY: [
    { label: "Review queue", href: "/faculty/reviews", icon: ClipboardList },
    { label: "My courses", href: "/faculty/courses", icon: BookOpen },
  ],
  COORDINATOR: [
    { label: "Clash desk", href: "/coordinator/clashes", icon: ShieldAlert },
    { label: "Broadcast", href: "/admin/broadcast", icon: Megaphone },
    { label: "Approvals", href: "/coordinator/approvals", icon: ClipboardList },
  ],
  FYP_HEAD: [
    { label: "FYP proposals", href: "/admin/fyp", icon: BookOpen },
    { label: "Resource requests", href: "/admin/requests", icon: Cpu },
    { label: "Reports", href: "/admin/reports", icon: FlaskConical },
  ],
  MENTOR: [{ label: "Mentor console", href: "/mentor", icon: ClipboardList }],
  ADMIN: [
    { label: "Users & roles", href: "/admin/users", icon: ShieldAlert },
    { label: "Audit log", href: "/admin/audit", icon: ClipboardList },
    { label: "Clash desk", href: "/coordinator/clashes", icon: Megaphone },
  ],
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Panel({ panel }: { panel: DashboardPanel }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex-row items-center justify-between gap-2 border-b px-5 py-3.5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <panel.icon className="h-4 w-4 text-muted-foreground" />
          {panel.title}
        </CardTitle>
        {panel.href ? (
          <Link
            href={panel.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            {panel.hrefLabel ?? "View all"}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="p-3">
        {panel.items.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">{panel.emptyText || "Nothing here yet."}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {panel.items.map((item) => {
              const inner = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    {item.subtitle ? (
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.subtitle}</p>
                    ) : null}
                    {item.meta ? <p className="text-[11px] text-muted-foreground/80">{item.meta}</p> : null}
                  </div>
                  {item.status ? (
                    <span className="shrink-0">
                      <StatusBadge status={item.status} />
                    </span>
                  ) : null}
                </div>
              );
              return (
                <li key={item.id} className="transition-[filter] hover:brightness-[0.985]">
                  {item.href ? (
                    <Link href={item.href} className="notif-item block">
                      {inner}
                    </Link>
                  ) : (
                    <div className="notif-item">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const noDb = !process.env.DATABASE_URL;
  let data: { stats: DashboardStat[]; panels: DashboardPanel[] } | null = null;
  let dbError = false;
  if (!noDb) {
    try {
      data = await getDashboard(user);
    } catch (error) {
      console.error("dashboard load failed:", error);
      dbError = true;
    }
  }

  const firstName = user.name.split(" ").slice(-1)[0] || user.name;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          <>
            {ROLE_LABELS[user.role]} portal ·{" "}
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </>
        }
        actions={
          <>
            {(QUICK_ACTIONS[user.role] ?? []).map((a) => (
              <Button key={a.href} variant={a === QUICK_ACTIONS[user.role][0] ? "default" : "outline"} size="sm" asChild>
                <Link href={a.href}>
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </Link>
              </Button>
            ))}
          </>
        }
      />

      {denied ? (
        <Alert variant="warning">
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            That page isn&apos;t available for your role. Pick a destination from the sidebar.
          </AlertDescription>
        </Alert>
      ) : null}

      {noDb || dbError ? (
        <Alert variant={dbError ? "destructive" : "warning"}>
          <AlertTitle>{dbError ? "Database unreachable" : "No database configured"}</AlertTitle>
          <AlertDescription>
            {dbError
              ? "The portal is live but the database didn't answer. Check the Neon project and the DATABASE_URL setting."
              : "Set DATABASE_URL (see .env.example) and run `prisma migrate deploy && bun run seed` to unlock live data."}
          </AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </section>

          <section aria-label="Work in progress" className="grid items-start gap-4 lg:grid-cols-2">
            {data.panels.map((panel) => (
              <Panel key={panel.title} panel={panel} />
            ))}
          </section>
        </>
      ) : null}

      {data && data.stats.every((s) => s.value === 0 || s.value === "None" || s.value === "0 / 0") ? (
        <EmptyState
          icon={Sparkles}
          title="A clean slate"
          description="Nothing needs your attention yet. Explore the sidebar to get started — or ask the AI assistant what's possible."
          action={
            <Button asChild>
              <Link href="/chat">Ask the assistant</Link>
            </Button>
          }
        />
      ) : null}
    </>
  );
}
