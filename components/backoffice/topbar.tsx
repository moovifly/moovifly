"use client";

import { type ReactNode } from "react";
import { Eye, EyeOff, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { MOBILE_NAV_ID, useMobileNav } from "@/components/backoffice/mobile-nav";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS } from "@/lib/auth";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { profile, viewAsVendedor, setViewAsVendedor } = useAuth();
  const { open: mobileNavOpen, setOpen: setMobileNavOpen, enabled: mobileNavEnabled } = useMobileNav();

  const isRealAdmin = profile?.tipo === "administrador";

  return (
    <>
      {viewAsVendedor && isRealAdmin && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--accent-600)]/30 bg-[var(--accent-glow)] px-4 py-1.5 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-[var(--accent-600)]" />
            <span className="text-xs font-medium text-[var(--accent-600)]">
              Visualizando como Vendedor
            </span>
          </div>
          <button
            type="button"
            onClick={() => setViewAsVendedor(false)}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-[var(--accent-600)] transition-colors hover:bg-[var(--accent-600)]/10"
          >
            <EyeOff className="h-3 w-3" />
            Sair
          </button>
        </div>
      )}
      <header className="sticky top-0 z-10 flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-card px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {/* Hambúrguer — abre o drawer de navegação mobile */}
          {mobileNavEnabled && (
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileNavOpen}
              aria-controls={MOBILE_NAV_ID}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            {title && (
              <h1 className="truncate font-display text-lg font-semibold leading-tight tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{subtitle}</p>
            )}
            {!title && profile && (
              <div>
                <p className="truncate font-display text-lg font-semibold leading-tight tracking-tight text-foreground">
                  {profile.nome}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                  {ROLE_LABELS[profile.tipo] ?? profile.tipo}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {isRealAdmin && !viewAsVendedor && (
            <button
              type="button"
              onClick={() => setViewAsVendedor(true)}
              title="Visualizar painel como Vendedor"
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-card px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar como
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>
    </>
  );
}
