"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";

/**
 * Confirm dialog around a server action — for decisions (approve/reject/allocate)
 * and destructive operations. Optionally collects a reason/remarks field and
 * passes it to the action as `formData.get(name)`.
 */
export function ConfirmAction({
  action,
  values = {},
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  reason,
  trigger,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: Record<string, string>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  /** Collect a free-text reason; submitted under this field name. */
  reason?: { name: string; label: string; placeholder?: string; required?: boolean };
  trigger: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          action={async (formData: FormData) => {
            await action(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          {Object.entries(values).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {children}
          {reason ? (
            <div className="space-y-1.5">
              <Label htmlFor={`reason-${reason.name}`}>{reason.label}</Label>
              <Textarea
                id={`reason-${reason.name}`}
                name={reason.name}
                placeholder={reason.placeholder}
                required={reason.required}
                rows={3}
              />
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {cancelLabel}
              </Button>
            </DialogClose>
            <SubmitButton variant={variant === "destructive" ? "destructive" : "default"} pendingLabel="Working…">
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
