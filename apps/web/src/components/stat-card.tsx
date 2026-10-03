import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "cn";

const TONES = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
} as const;

export type StatTone = keyof typeof TONES;

/** Dashboard stat tile: icon bubble, big value, label, optional hint + link. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: StatTone;
  className?: string;
}) {
  const body = (
    <Card className={cn("@container/card relative gap-3 overflow-hidden p-5", href && "card-lift", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {href ? (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover/stat:opacity-100" />
        ) : null}
      </div>
      <div className="space-y-0.5">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="text-sm font-medium text-foreground/90">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="group/stat block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {body}
      </Link>
    );
  }
  return body;
}
