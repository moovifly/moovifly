import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--bg-overlay)] text-foreground",
        success: "bg-[var(--success-bg)] text-[var(--success-text)]",
        warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
        info: "bg-[var(--info-bg)] text-[var(--info-text)]",
        destructive: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
