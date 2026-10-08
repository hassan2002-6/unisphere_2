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
  PRESENT: "success",
  // negative / closed
  REJECTED: "danger",
  DECLINED: "danger",
  REVOKED: "danger",
  CLOSED: "neutral",
  WITHDRAWN: "neutral",
  CANCELLED: "neutral",
  ABSENT: "danger",
  DISMISSED: "neutral",
  // in flight
  SUBMITTED: "progress",
  UNDER_REVIEW: "progress",
  PENDING: "progress",
  RECOMMENDED: "progress",
  IN_REVIEW: "progress",
  PROPOSED: "progress",
  SHORTLISTED: "progress",
  LATE: "progress",
  EXCUSED: "info",
  APPLIED: "info",
  CONFIRMED: "info",
  QUIZ: "info",
  ASSIGNMENT: "info",
  MIDTERM: "progress",
  FINAL: "danger",
  PROJECT: "info",
};

const TONE_CLASS: Record<Tone, string> = {
  /* Pastel badge palette straight from setup2.html (light) + dark equivalents */
  success: "border-transparent bg-[#d4edda] text-[#155724] dark:bg-[#155724]/30 dark:text-[#93d9ab]",
  danger: "border-transparent bg-[#f8d7da] text-[#721c24] dark:bg-[#721c24]/35 dark:text-[#f4aeb6]",
  progress: "border-transparent bg-[#fff3cd] text-[#856404] dark:bg-[#856404]/30 dark:text-[#f2d78d]",
  info: "border-transparent bg-[#d1ecf1] text-[#0c5460] dark:bg-[#0c5460]/35 dark:text-[#93d5e2]",
  neutral: "border-transparent bg-[#f5f5f5] text-[#555555] dark:bg-muted dark:text-muted-foreground",
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
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
  DISMISSED: "Dismissed",
  TIMETABLE: "Timetable",
  EXAM: "Exam",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  MIDTERM: "Midterm",
  FINAL: "Final",
  PROJECT: "Project",
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
