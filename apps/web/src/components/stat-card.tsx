import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "cn";

const VALUE_TONES = {
  default: "text-primary",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
} as const;

export type StatTone = keyof typeof VALUE_TONES;

/**
 * Dashboard stat tile — the setup2.html prototype card:
 * uppercase muted label, big red value, small sub line.
 */
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
    <Card className={cn("relative gap-0 overflow-hidden p-5", href && "card-lift", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      </div>
      <p className={cn("mt-1.5 text-[28px] leading-tight font-bold tabular-nums", VALUE_TONES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {href ? (
        <ArrowUpRight className="absolute right-4 bottom-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover/stat:opacity-100" />
      ) : null}
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
