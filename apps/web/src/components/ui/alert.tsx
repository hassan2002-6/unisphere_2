import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";

const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-info/30 bg-info/10 text-foreground [&>svg]:text-info",
        success: "border-success/30 bg-success/10 text-foreground [&>svg]:text-success",
        warning: "border-warning/35 bg-warning/10 text-foreground [&>svg]:text-warning",
        destructive: "border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive",
        muted: "border-border bg-muted/60 text-muted-foreground [&>svg]:text-muted-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  destructive: OctagonXIcon,
  muted: InfoIcon,
} as const;

function Alert({
  className,
  variant = "info",
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & { icon?: React.ReactNode | null }) {
  const key = (variant ?? "info") as keyof typeof ICONS;
  const Icon = ICONS[key] ?? InfoIcon;
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon === null ? null : (icon ?? <Icon className="mt-0.5 h-4 w-4" />)}
      <div className="min-w-0 space-y-0.5">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-medium leading-5", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm leading-5 text-muted-foreground", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
