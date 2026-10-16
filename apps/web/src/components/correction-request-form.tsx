"use client";

import { useActionState, useState } from "react";
import { SquarePen } from "lucide-react";
import { requestCorrectionAction, type CorrectionActionState } from "@/app/(portal)/faculty/students/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

/**
 * Faculty "request correction" form (goal §6). The field list is passed in by
 * the server page straight from the service whitelist — the client cannot add
 * to it — and the current value shown here is display-only: the real current
 * value is re-captured server-side when the request is stored.
 */

export type CorrectionFieldOption = {
  /** "<entityType>:<field>" — the exact whitelist entry the service accepts. */
  target: string;
  label: string;
  currentValue: string;
};

export function CorrectionRequestForm({ recordId, options }: { recordId: string; options: CorrectionFieldOption[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(options[0]?.target ?? "");
  const [state, formAction] = useActionState<CorrectionActionState | null, FormData>(
    async (_prev, formData) => requestCorrectionAction(formData),
    null,
  );

  if (options.length === 0) return null;
  const current = options.find((option) => option.target === target)?.currentValue || "—";

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant={open ? "ghost" : "secondary"}
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SquarePen className="h-3.5 w-3.5" />
        {open ? "Cancel" : "Request correction"}
      </Button>

      {open ? (
        <form action={formAction} className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
          <input type="hidden" name="recordId" value={recordId} />
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Field</span>
            <select
              name="target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {options.map((option) => (
                <option key={option.target} value={option.target}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Current value</span>
            <p className="flex h-8 items-center rounded-lg border border-border/70 bg-muted/40 px-2.5 text-sm font-mono break-all">
              {current}
            </p>
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">New value</span>
            <Input name="newValue" required placeholder="The correct value" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Reason</span>
            <Input name="reason" required minLength={5} placeholder="e.g. section changed by the HOD" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Submitting…">Submit for review</SubmitButton>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Only whitelisted fields are accepted. An administrator reviews the request — approved values are applied to
            the record automatically and you are notified either way.
          </p>
        </form>
      ) : null}

      {state ? (
        <Alert variant={state.ok ? "success" : "destructive"}>
          <AlertTitle>{state.ok ? "Request sent" : "Not submitted"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
