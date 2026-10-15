"use client";

import { useFormStatus } from "react-dom";
import { Check, PencilLine, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Queue decision buttons with a shared pending state (server action in the form). */
export function ReviewActions({ status, disabled }: { status: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const off = pending || disabled;
  const decidable = status === "SUBMITTED" || status === "UNDER_REVIEW";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "SUBMITTED" ? (
        <Button type="submit" name="decision" value="UNDER_REVIEW" variant="secondary" size="sm" disabled={off}>
          <Play className="h-3.5 w-3.5" />
          Start review
        </Button>
      ) : null}
      {decidable ? (
        <Button type="submit" name="decision" value="CORRECTIONS_REQUESTED" variant="outline" size="sm" disabled={off}>
          <PencilLine className="h-3.5 w-3.5" />
          Request corrections
        </Button>
      ) : null}
      <Button
        type="submit"
        name="decision"
        value="APPROVED"
        size="sm"
        disabled={off}
        className="bg-success text-white hover:bg-success/90"
      >
        <Check className="h-3.5 w-3.5" />
        Approve
      </Button>
      <Button type="submit" name="decision" value="REJECTED" variant="destructive" size="sm" disabled={off}>
        <X className="h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}
