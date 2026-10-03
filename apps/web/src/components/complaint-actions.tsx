"use client";

import { useFormStatus } from "react-dom";
import { Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Complaint transition buttons with a shared pending state (server action in the form). */
export function ComplaintActions({ status }: { status: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "OPEN" ? (
        <Button type="submit" name="status" value="IN_REVIEW" variant="secondary" size="sm" disabled={pending}>
          <Play className="h-3.5 w-3.5" />
          Start review
        </Button>
      ) : null}
      {status === "IN_REVIEW" ? (
        <Button
          type="submit"
          name="status"
          value="RESOLVED"
          size="sm"
          disabled={pending}
          className="bg-success text-white hover:bg-success/90"
        >
          <Check className="h-3.5 w-3.5" />
          Resolve
        </Button>
      ) : null}
      {status === "IN_REVIEW" || status === "RESOLVED" ? (
        <Button type="submit" name="status" value="CLOSED" variant="outline" size="sm" disabled={pending}>
          <X className="h-3.5 w-3.5" />
          Close
        </Button>
      ) : null}
    </div>
  );
}
