"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NAV_BY_ROLE } from "@/lib/nav";
import { ROLE_LABELS, type Role } from "@/lib/rbac";

export function PortalShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sections = NAV_BY_ROLE[user.role];

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <span className="text-lg font-bold tracking-tight text-sidebar-accent-foreground">
            UniSphere
          </span>
        </div>
        <Separator className="bg-sidebar-border" />
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/60"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
            {user.name}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight md:hidden">UniSphere</span>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
              <Link href="/notifications">
                <Bell className="h-4 w-4" />
              </Link>
            </Button>
            <UserButton />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
