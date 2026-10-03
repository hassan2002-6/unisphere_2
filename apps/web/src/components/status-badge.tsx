import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

type Tone = "progress" | "success" | "danger" | "neutral" | "info";

const STATUS_TONE: Record<string, Tone> = {
  // positive / done
  APPROVED: "success",
  ACCEPTED: "success",
  RESOLVED: "success",
  COMPLETED: "success",
  ALLOCATED: "success",
  ACTIVE: "success",
  OPEN: "success",
  // negative / closed
  REJECTED: "danger",
  DECLINED: "danger",
  REVOKED: "danger",
  CLOSED: "neutral",
  WITHDRAWN: "neutral",
  CANCELLED: "neutral",
  // in flight
  SUBMITTED: "progress",
  UNDER_REVIEW: "progress",
  PENDING: "progress",
  RECOMMENDED: "progress",
  IN_REVIEW: "progress",
  PROPOSED: "progress",
  SHORTLISTED: "progress",
  APPLIED: "info",
  CONFIRMED: "info",
};

const TONE_CLASS: Record<Tone, string> = {
  success: "border-success/25 bg-success/10 text-success dark:text-[color-mix(in_oklab,var(--success),white_20%)]",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  progress: "border-warning/30 bg-warning/10 text-warning dark:text-[color-mix(in_oklab,var(--warning),white_15%)]",
  info: "border-info/25 bg-info/10 text-info dark:text-[color-mix(in_oklab,var(--info),white_15%)]",
  neutral: "border-border bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-destructive",
  progress: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground/60",
};

const FRIENDLY: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  OPEN: "Open",
  CLOSED: "Closed",
  PENDING: "Pending",
  RECOMMENDED: "Recommended",
  ALLOCATED: "Allocated",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  REVOKED: "Revoked",
  CANCELLED: "Cancelled",
  PROPOSED: "Proposed",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  ACCEPTED: "Accepted",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = FRIENDLY[status] ?? status.replaceAll("_", " ").toLowerCase();
  return (
    <Badge variant="outline" className={cn("gap-1.5 capitalize", TONE_CLASS[tone], className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
      {label}
    </Badge>
  );
}
