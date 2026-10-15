"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { Bell, GraduationCap, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_BY_ROLE, navItemForPath, pageTitleFor } from "@/lib/nav";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "cn";

type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  registrationNo: string | null;
  employeeId: string | null;
  hasAvatar: boolean;
};

/** "Student Portal", "Faculty Portal", …… — the prototype's sidebar subtitle. */
const PORTAL_NAMES: Record<Role, string> = {
  STUDENT: "Student Portal",
  FACULTY: "Faculty Portal",
  COORDINATOR: "Program Manager Portal",
  FYP_HEAD: "FYP Head Portal",
  MENTOR: "Mentor Portal",
  ADMIN: "Administrator Portal",
};

/** Red header block — logo + portal name, exactly like the prototype's sidebar header. */
function Brand({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex flex-col gap-0.5 bg-primary px-5 py-5 text-primary-foreground"
    >
      <span className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6" />
        <span className="text-[22px] leading-none font-bold tracking-tight">UniSphere</span>
      </span>
      <span className="pl-8 text-[11px] opacity-85">{PORTAL_NAMES[role]}</span>
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
    <nav className="flex-1 overflow-y-auto py-3">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {section.title}
          </p>
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 border-l-[3px] border-transparent px-5 py-[11px] text-sm transition-[background-color,color] duration-150",
                      active
                        ? "border-l-primary bg-secondary font-semibold text-primary"
                        : "text-sidebar-foreground hover:bg-secondary hover:text-primary",
                    )}
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
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-card">
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
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Sidebar (desktop) — 240px, red header, prototype menu states */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Brand role={user.role} />
        <NavLinks role={user.role} pathname={pathname} />
        <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-muted-foreground">
          Salim Habib University
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-[30px]">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 gap-0 border-sidebar-border bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand role={user.role} onNavigate={() => setMenuOpen(false)} />
                <NavLinks role={user.role} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-muted-foreground">
                  Salim Habib University
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <p className="truncate text-lg leading-tight font-semibold tracking-tight">{title}</p>
              {nav && nav.section !== "Overview" ? (
                <p className="hidden text-[11px] text-muted-foreground sm:block">{nav.section}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {bell}
            <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
            {/* User block — avatar (photo or crimson initials) + name/role (prototype topbar) */}
            <UserAvatar name={user.name} userId={user.id} hasAvatar={user.hasAvatar} />
            <div className="hidden leading-tight sm:block">
              <span className="block text-[13px] font-semibold">{user.name}</span>
              <small className="block text-[11px] text-muted-foreground">
                {ROLE_LABELS[user.role]}
                {user.registrationNo ?? user.employeeId ? (
                  <span className="font-mono text-primary"> · {user.registrationNo ?? user.employeeId}</span>
                ) : null}
              </small>
            </div>
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-primary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </SignOutButton>
          </div>
        </header>

        <main id="main-content" className="page animate-in fade-in-0 duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
