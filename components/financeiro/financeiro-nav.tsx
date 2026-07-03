"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, BadgePercent, BarChart3, LayoutList } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/backoffice/financeiro/", label: "Lançamentos", icon: LayoutList, exact: true },
  { href: "/backoffice/financeiro/comissoes/", label: "Comissões", icon: BadgePercent, exact: false },
  { href: "/backoffice/financeiro/fluxo-de-caixa/", label: "Fluxo de Caixa", icon: ArrowLeftRight, exact: false },
  { href: "/backoffice/financeiro/relatorio/", label: "Relatório", icon: BarChart3, exact: false },
] as const;

export function FinanceiroNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-3">
      {NAV_ITEMS.map((item) => {
        const normalized = pathname.replace(/\/$/, "");
        const hrefNormalized = item.href.replace(/\/$/, "");
        const active = item.exact
          ? normalized === hrefNormalized
          : normalized.startsWith(hrefNormalized);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--accent-glow)] text-[var(--accent-600)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
