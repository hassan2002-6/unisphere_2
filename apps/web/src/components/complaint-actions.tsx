"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Quick-action buttons for the complaint queue. Each button carries its own
 * `action` value into the shared server action (spec §6 recipient actions).
 */
export function ComplaintActions({ status }: { status: string }) {
  const { pending } = useFormStatus();

  const actions: { value: string; label: string; primary?: boolean }[] = [];
  if (status === "OPEN") actions.push({ value: "acknowledge", label: "Acknowledge" });
  if (status === "IN_REVIEW" || status === "AWAITING_INFO" || status === "OPEN")
    actions.push({ value: "respond", label: "Respond" });
  if (status === "IN_REVIEW" || status === "AWAITING_INFO")
    actions.push({ value: "request_info", label: "Request info" });
  if (status === "IN_REVIEW" || status === "AWAITING_INFO") actions.push({ value: "resolve", label: "Resolve", primary: true });
  if (status === "RESOLVED") actions.push({ value: "close", label: "Close" });

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.value}
          type="submit"
          name="action"
          value={a.value}
          variant={a.primary ? "default" : "outline"}
          size="sm"
          disabled={pending}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
