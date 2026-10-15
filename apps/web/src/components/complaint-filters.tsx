import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

/**
 * GET filter bar for the complaint queues (faculty + coordinator). Submitting
 * reloads the same route with query params — the page reads them and the
 * service whitelists every value before it reaches Prisma.
 */
export function ComplaintFilters({
  status = "",
  priority = "",
  overdue = false,
  q = "",
}: {
  status?: string;
  priority?: string;
  overdue?: boolean;
  q?: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Status
        <select
          name="status"
          defaultValue={status}
          className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">Any</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="AWAITING_INFO">Awaiting info</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </label>

      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Priority
        <select
          name="priority"
          defaultValue={priority}
          className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">Any</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </label>

      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Search
        <Input name="q" defaultValue={q} placeholder="Ref or subject…" className="h-9 w-52" />
      </label>

      <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-4 accent-primary" />
        Overdue only
      </label>

      <Button type="submit" variant="secondary" size="sm" className="h-9">
        <Search className="h-3.5 w-3.5" />
        Filter
      </Button>
    </form>
  );
}
