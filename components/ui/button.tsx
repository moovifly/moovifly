import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-600)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-600)] text-white hover:bg-[var(--accent-500)]",
        destructive:
          "bg-[var(--danger-bg)] text-[var(--danger-text)] hover:bg-[var(--danger-bg)]/80 border border-[var(--danger-border)]",
        outline:
          "border border-[var(--border-default)] bg-transparent hover:bg-[var(--bg-hover)] text-foreground",
        secondary:
          "bg-[var(--bg-elevated)] text-foreground hover:bg-[var(--bg-overlay)]",
        ghost:
          "hover:bg-[var(--bg-hover)] text-foreground",
        link: "text-[var(--accent-600)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
