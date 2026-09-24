import { Badge } from "@/components/ui/badge";

const TONE: Record<string, string> = {
  // green — done well
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ALLOCATED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  // red — negative terminal
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  DECLINED: "bg-red-100 text-red-800 border-red-200",
  REVOKED: "bg-red-100 text-red-800 border-red-200",
  // amber — in flight
  SUBMITTED: "bg-amber-100 text-amber-800 border-amber-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  RECOMMENDED: "bg-amber-100 text-amber-800 border-amber-200",
  IN_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  OPEN: "bg-amber-100 text-amber-800 border-amber-200",
  PROPOSED: "bg-amber-100 text-amber-800 border-amber-200",
  SHORTLISTED: "bg-amber-100 text-amber-800 border-amber-200",
  APPLIED: "bg-amber-100 text-amber-800 border-amber-200",
  // gray — closed/neutral
  WITHDRAWN: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
  CLOSED: "bg-slate-100 text-slate-700 border-slate-200",
  CONFIRMED: "bg-sky-100 text-sky-800 border-sky-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = TONE[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <Badge variant="outline" className={cls}>
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
