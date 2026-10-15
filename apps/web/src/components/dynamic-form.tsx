"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import type { FormFieldSpec } from "@/lib/validation";

export type FormActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { path: string; message: string }[];
};

const CONTROL_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/**
 * Renders a form from a template's field spec (plan C7). The server action
 * re-validates everything with the same schema — this is a UX helper, never a
 * trust boundary.
 */
export function DynamicForm({
  fields,
  action,
  submitLabel = "Submit request",
  defaultValues,
  pendingNote = "You'll get a notification with the reviewer's decision.",
  attachment,
}: {
  fields: FormFieldSpec[];
  action: (prev: FormActionState | undefined, fd: FormData) => Promise<FormActionState>;
  submitLabel?: string;
  /** Prefill (used when resubmitting after a corrections request). */
  defaultValues?: Record<string, unknown>;
  pendingNote?: string;
  /** Supporting-document upload block (label + whether it's mandatory). */
  attachment?: { label: string; required?: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errorFor = (name: string) => state.fieldErrors?.find((e) => e.path === name)?.message;
  const dv = (name: string) => {
    const v = defaultValues?.[name];
    return v === null || v === undefined ? undefined : String(v);
  };

  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      {fields.map((f) => {
        const err = errorFor(f.name);
        return (
          <div key={f.name} className="grid gap-1.5">
            <Label htmlFor={f.name} className="text-sm">
              {f.label}
              {f.required ? <span className="ml-1 text-destructive" aria-hidden>*</span> : null}
              {!f.required ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span> : null}
            </Label>

            {f.type === "textarea" ? (
              <Textarea
                id={f.name}
                name={f.name}
                placeholder={f.placeholder}
                rows={4}
                required={f.required}
                defaultValue={dv(f.name)}
                aria-invalid={err ? true : undefined}
              />
            ) : f.type === "select" ? (
              <select
                id={f.name}
                name={f.name}
                required={f.required}
                defaultValue={dv(f.name) ?? ""}
                aria-invalid={err ? true : undefined}
                className={cn(CONTROL_CLASS, "appearance-none bg-[length:1rem] pr-8")}
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
              <label
                htmlFor={f.name}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
              >
                <input
                  id={f.name}
                  name={f.name}
                  type="checkbox"
                  defaultChecked={defaultValues?.[f.name] === true}
                  className="size-4 shrink-0 accent-primary"
                  aria-invalid={err ? true : undefined}
                />
                <span className="text-sm text-muted-foreground">{f.placeholder ?? "Tick to confirm"}</span>
              </label>
            ) : (
              <Input
                id={f.name}
                name={f.name}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                placeholder={f.placeholder}
                required={f.required}
                defaultValue={dv(f.name)}
                aria-invalid={err ? true : undefined}
              />
            )}

            {err ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {err}
              </p>
            ) : null}
          </div>
        );
      })}

      {attachment ? (
        <div className="grid gap-1.5">
          <Label htmlFor="attachment" className="text-sm">
            {attachment.label}
            {attachment.required ? <span className="ml-1 text-destructive" aria-hidden>*</span> : (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span>
            )}
          </Label>
          <input
            id="attachment"
            name="attachment"
            type="file"
            required={attachment.required}
            accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.zip"
            className="border-input rounded-md border bg-transparent px-2.5 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-0.5 file:text-xs"
          />
          <p className="text-xs text-muted-foreground">
            PDF, Word, text, image or zip — up to 2 MB. The reviewer can download it with your request.
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Submitting…" : submitLabel}
        </Button>
        <p className="text-xs text-muted-foreground">{pendingNote}</p>
      </div>
    </form>
  );
}
