import { Badge } from "@/components/ui/badge";
import type { ClashKind } from "@/server/clash";

const KIND_META: Record<ClashKind, { label: string; className: string }> = {
  room: { label: "Room clash", className: "bg-destructive/10 text-destructive border-destructive/30" },
  lab: { label: "Lab clash", className: "bg-destructive/10 text-destructive border-destructive/30" },
  faculty: { label: "Faculty clash", className: "bg-warning/15 text-amber-700 border-amber-300" },
  cohort: { label: "Section clash", className: "bg-warning/15 text-amber-700 border-amber-300" },
  "exam-vs-class": { label: "Exam vs class", className: "bg-destructive/10 text-destructive border-destructive/30" },
  "exam-hall": { label: "Hall clash", className: "bg-destructive/10 text-destructive border-destructive/30" },
  "exam-cohort": { label: "Exam section clash", className: "bg-warning/15 text-amber-700 border-amber-300" },
};

export function ClashBadge({ kind }: { kind: ClashKind }) {
  const meta = KIND_META[kind];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}
