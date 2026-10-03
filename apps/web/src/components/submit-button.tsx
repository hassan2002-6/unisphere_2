"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

/** Submit button that reflects the enclosing <form action> pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} variant={variant} size={size} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Inline status line for a form (use with useActionState result.error). */
export function FormError({ error, className }: { error?: string | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={`rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive ${className ?? ""}`}>
      {error}
    </p>
  );
}
