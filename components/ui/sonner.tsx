"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme === "dark" ? "dark" : "light") as ToasterProps["theme"];

  return (
    <SonnerToaster
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-[var(--border-subtle)] group-[.toaster]:shadow-[var(--shadow-md)]",
          description: "group-[.toast]:text-[var(--text-secondary)]",
          actionButton:
            "group-[.toast]:bg-[var(--accent-solid)] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[var(--bg-overlay)] group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
