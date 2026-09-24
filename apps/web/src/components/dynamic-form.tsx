"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormFieldSpec } from "@/lib/validation";

export type FormActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { path: string; message: string }[];
};

/**
 * Renders a form from a template's field spec (plan C7). The server action
 * re-validates everything with the same schema — this is a UX helper, never a
 * trust boundary.
 */
export function DynamicForm({
  fields,
  action,
  submitLabel = "Submit",
}: {
  fields: FormFieldSpec[];
  action: (prev: FormActionState | undefined, fd: FormData) => Promise<FormActionState>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errorFor = (name: string) => state.fieldErrors?.find((e) => e.path === name)?.message;

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      {fields.map((f) => (
        <div key={f.name} className="grid gap-1.5">
          <Label htmlFor={f.name}>
            {f.label}
            {f.required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>

          {f.type === "textarea" ? (
            <Textarea id={f.name} name={f.name} placeholder={f.placeholder} rows={4} required={f.required} />
          ) : f.type === "select" ? (
            <select
              id={f.name}
              name={f.name}
              required={f.required}
              defaultValue=""
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="" disabled>
                Select…
              </option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <div className="flex items-center gap-2">
              <input id={f.name} name={f.name} type="checkbox" className="size-4 accent-primary" />
              <span className="text-sm text-muted-foreground">{f.placeholder ?? "Tick to confirm"}</span>
            </div>
          ) : (
            <Input
              id={f.name}
              name={f.name}
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              placeholder={f.placeholder}
              required={f.required}
            />
          )}

          {errorFor(f.name) ? <p className="text-xs text-destructive">{errorFor(f.name)}</p> : null}
        </div>
      ))}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Submitting…" : submitLabel}
      </Button>
    </form>
  );
}
