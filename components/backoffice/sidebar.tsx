"use client";

import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  FileText,
  ShoppingCart,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  CreditCard,
} from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { showConfirm } from "@/components/confirm-modal";
import { BackofficeLink } from "@/components/backoffice/backoffice-link";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/backoffice/dashboard/", label: "Dashboard", icon: LayoutGrid },
  { href: "/backoffice/clientes/", label: "Clientes", icon: Users },
  { href: "/backoffice/orcamentos/", label: "Orçamentos", icon: FileText },
  { href: "/backoffice/vendas/", label: "Vendas", icon: ShoppingCart },
  {
    href: "/backoffice/relatorios/",
    label: "Relatórios",
    icon: BarChart3,
    roles: ["administrador", "gerente"],
  },
  { href: "/backoffice/financeiro/", label: "Financeiro", icon: Wallet },
  { href: "/backoffice/checkout/", label: "Checkout", icon: CreditCard },
];

const SECONDARY_ITEMS: NavItem[] = [
  {
    href: "/backoffice/configuracoes/",
    label: "Configurações",
    icon: Settings,
    roles: ["administrador"],
  },
];

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const { profile, signOut } = useAuth();

  const canAccess = (roles?: string[]) => !roles || (profile && roles.includes(profile.tipo));

  const handleLogout = async () => {
    const ok = await showConfirm({
      title: "Sair do sistema",
      message: "Deseja realmente sair? Você precisará entrar novamente para acessar o backoffice.",
      confirmText: "Sair",
      cancelText: "Cancelar",
    });
    if (ok) await signOut();
  };

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-20 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-card md:flex">
      <div className="flex h-16 items-center justify-center border-b border-[var(--border-subtle)]">
        <BackofficeLink href="/backoffice/dashboard/" aria-label="MooviFly Dashboard">
          <Image
            src="/favicon.png"
            alt="MooviFly"
            width={40}
            height={40}
            className="h-10 w-10 rounded-md"
          />
        </BackofficeLink>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2 py-4">
        {NAV_ITEMS.filter((item) => canAccess(item.roles)).map((item) => {
          const active = pathname.startsWith(item.href.replace(/\/$/, ""));
          const Icon = item.icon;
          return (
            <BackofficeLink
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors",
                "hover:bg-[var(--bg-hover)] hover:text-foreground",
                active && "bg-[var(--accent-glow)] text-[var(--accent-600)]",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-card px-2 py-1 text-xs text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </BackofficeLink>
          );
        })}

        <div className="my-2 h-px w-8 bg-[var(--border-subtle)]" />

        {SECONDARY_ITEMS.filter((item) => canAccess(item.roles)).map((item) => {
          const active = pathname.startsWith(item.href.replace(/\/$/, ""));
          const Icon = item.icon;
          return (
            <BackofficeLink
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors",
                "hover:bg-[var(--bg-hover)] hover:text-foreground",
                active && "bg-[var(--accent-glow)] text-[var(--accent-600)]",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-card px-2 py-1 text-xs text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </BackofficeLink>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 border-t border-[var(--border-subtle)] py-4">
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          className="flex h-12 w-12 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <Avatar className="h-10 w-10">
          <AvatarFallback>{getInitials(profile?.nome ?? "?")}</AvatarFallback>
        </Avatar>
      </div>
    </aside>
  );
}
