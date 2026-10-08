import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

export type Crumb = { label: string; href?: string };

/**
 * Standard page header: optional breadcrumb, title + description on the left,
 * actions on the right. Used by every portal page for a consistent frame.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 opacity-60" /> : null}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-medium text-foreground">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* The visible page title lives in the topbar (prototype); keep an
            accessible heading here so the document outline stays correct. */}
        <h1 className="sr-only">{title}</h1>
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary sm:flex">
              <Icon className="h-4.5 w-4.5" />
            </span>
          ) : null}
          {description ? (
            <div className="max-w-3xl text-[13px] leading-6 text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
