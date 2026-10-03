"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bell, GraduationCap, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { NAV_BY_ROLE, navItemForPath, pageTitleFor } from "@/lib/nav";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "cn";

type ShellUser = { name: string; email: string; role: Role };

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md px-1 py-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <GraduationCap className="h-4.5 w-4.5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">UniSphere</span>
        {!compact ? (
          <span className="text-[11px] text-sidebar-foreground/60">Salim Habib University</span>
        ) : null}
      </span>
    </Link>
  );
}

function NavLinks({
  role,
  pathname,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
}) {
  const sections = NAV_BY_ROLE[role];
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
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
  );
}

function UserCard({ user }: { user: ShellUser }) {
  return (
    <div className="border-t border-sidebar-border px-4 py-3.5">
      <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
      <p className="mt-0.5 truncate text-xs text-sidebar-foreground/60">{user.email}</p>
      <Badge variant="outline" className="mt-2 border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
        {ROLE_LABELS[user.role]}
      </Badge>
    </div>
  );
}

export function PortalShell({
  user,
  unreadCount,
  children,
}: {
  user: ShellUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const title = pageTitleFor(pathname, user.role);
  const nav = navItemForPath(pathname, user.role);

  const bell = (
    <Button variant="ghost" size="icon" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`} asChild>
      <Link href="/notifications" className="relative">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-card">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Link>
    </Button>
  );

  return (
    <div className="flex min-h-dvh flex-1">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center px-4">
          <Brand />
        </div>
        <div className="mx-3 h-px bg-sidebar-border" />
        <NavLinks role={user.role} pathname={pathname} />
        <UserCard user={user} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-card/85 px-4 backdrop-blur-sm md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <div className="flex h-16 items-center px-4">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Brand compact />
                </div>
                <div className="mx-3 h-px bg-sidebar-border" />
                <NavLinks role={user.role} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                <UserCard user={user} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              {nav && nav.section !== "Overview" ? (
                <p className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
                  {nav.section}
                </p>
              ) : null}
              <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {bell}
            <div className="ml-1">
              <UserButton
                appearance={{ elements: { avatarBox: "h-8 w-8 ring-1 ring-border" } }}
              />
            </div>
          </div>
        </header>

        <main id="main-content" className="page animate-in fade-in-0 duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
