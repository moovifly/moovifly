"use client";

import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-[var(--border-subtle)] group-[.toaster]:shadow-[var(--shadow-md)]",
          description: "group-[.toast]:text-[var(--text-secondary)]",
          actionButton:
            "group-[.toast]:bg-[var(--accent-600)] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[var(--bg-overlay)] group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
