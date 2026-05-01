"use client";

import { type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS } from "@/lib/auth";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-[var(--topbar-height)] items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-card px-4 md:px-6">
      <div className="min-w-0">
        {title && (
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
        )}
        {subtitle && (
          <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
        )}
        {!title && profile && (
          <div>
            <p className="text-sm font-semibold text-foreground">{profile.nome}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {ROLE_LABELS[profile.tipo] ?? profile.tipo}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
