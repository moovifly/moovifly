"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileText,
  LayoutGrid,
  LogOut,
  PlaneTakeoff,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/auth";
import { showConfirm } from "@/components/confirm-modal";
import { BackofficeLink } from "@/components/backoffice/backoffice-link";

/** Preferência de sidebar recolhida — persiste entre navegações (reload completo). */
const COLLAPSE_STORAGE_KEY = "moovifly:sidebar-collapsed";

type IconType = React.ComponentType<{ className?: string }>;

type SubNavItem = {
  href: string;
  label: string;
  /** Aba da página de configurações (query param `tab`). */
  tab?: string;
};

type NavEntry = {
  href: string;
  label: string;
  icon: IconType;
  roles?: string[];
  children?: SubNavItem[];
};

type NavSection = { label: string; items: NavEntry[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Principal",
    items: [
      { href: "/backoffice/dashboard/", label: "Dashboard", icon: LayoutGrid },
      { href: "/backoffice/clientes/", label: "Clientes", icon: Users },
      { href: "/backoffice/orcamentos/", label: "Orçamentos", icon: FileText },
      { href: "/backoffice/vendas/", label: "Vendas", icon: ShoppingCart },
      { href: "/backoffice/embarques/", label: "Embarques", icon: PlaneTakeoff },
    ],
  },
  {
    label: "Análise",
    items: [{ href: "/backoffice/relatorios/", label: "Relatórios", icon: BarChart3 }],
  },
  {
    label: "Gestão",
    items: [
      {
        href: "/backoffice/financeiro/",
        label: "Financeiro",
        icon: Wallet,
        roles: ["administrador", "gerente"],
        children: [
          { href: "/backoffice/financeiro/", label: "Lançamentos" },
          { href: "/backoffice/financeiro/comissoes/", label: "Comissões" },
          { href: "/backoffice/financeiro/fluxo-de-caixa/", label: "Fluxo de Caixa" },
          { href: "/backoffice/financeiro/relatorio/", label: "Relatório" },
        ],
      },
      {
        href: "/backoffice/checkout/",
        label: "Checkout",
        icon: CreditCard,
        roles: ["administrador", "gerente"],
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        href: "/backoffice/configuracoes/",
        label: "Configurações",
        icon: Settings,
        roles: ["administrador"],
        children: [
          { href: "/backoffice/configuracoes/?tab=usuarios", label: "Usuários", tab: "usuarios" },
          { href: "/backoffice/configuracoes/?tab=contas-bancarias", label: "Contas Bancárias", tab: "contas-bancarias" },
        ],
      },
    ],
  },
];

const stripTrailingSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** Item de topo: ativo na própria rota ou em qualquer rota filha. */
function isEntryActive(pathname: string, entry: NavEntry) {
  const base = stripTrailingSlash(entry.href);
  const current = stripTrailingSlash(pathname);
  return current === base || current.startsWith(`${base}/`);
}

function ItemTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-card px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-[var(--shadow-md)] transition-opacity group-hover:opacity-100">
      {label}
    </span>
  );
}

function ActiveBar({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent-600)]",
        collapsed ? "-left-[18px]" : "-left-3",
      )}
    />
  );
}

function NavLeafLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <BackofficeLink
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 shrink-0 items-center rounded-[10px] text-[13px] font-medium transition-colors",
        collapsed ? "mx-auto w-11 justify-center" : "mx-3 gap-3 px-3",
        active
          ? "bg-[var(--accent-glow)] text-[var(--accent-600)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-foreground",
      )}
    >
      {active && <ActiveBar collapsed={collapsed} />}
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <ItemTooltip label={label} />}
    </BackofficeLink>
  );
}

function SubmenuLinks({
  items,
  isActive,
}: {
  items: SubNavItem[];
  isActive: (item: SubNavItem) => boolean;
}) {
  return (
    <div className="ml-[26px] mr-3 mt-1 flex flex-col gap-0.5 border-l border-[var(--border-subtle)] pb-1 pl-3">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <BackofficeLink
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors",
              active
                ? "bg-[var(--accent-glow)] font-medium text-[var(--accent-600)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-foreground",
            )}
          >
            <span className="truncate">{item.label}</span>
          </BackofficeLink>
        );
      })}
    </div>
  );
}

/** Submenu cujos itens são abas via query param `tab` (Configurações). */
function TabAwareSubmenu({ items, pathname }: { items: SubNavItem[]; pathname: string }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get("tab") ?? "usuarios";
  const current = stripTrailingSlash(pathname);
  return (
    <SubmenuLinks
      items={items}
      isActive={(item) =>
        current === stripTrailingSlash(item.href.split("?")[0] ?? "") && item.tab === activeTab
      }
    />
  );
}

function NavGroupItem({
  entry,
  pathname,
  collapsed,
}: {
  entry: NavEntry;
  pathname: string;
  collapsed: boolean;
}) {
  const parentActive = isEntryActive(pathname, entry);
  const [open, setOpen] = useState(parentActive);
  const Icon = entry.icon;
  const children = entry.children ?? [];
  const hasTabs = children.some((c) => c.tab);
  const current = stripTrailingSlash(pathname);

  if (collapsed) {
    return (
      <NavLeafLink href={entry.href} label={entry.label} icon={Icon} active={parentActive} collapsed />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "group relative mx-3 flex h-10 w-[calc(100%-24px)] items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-medium transition-colors",
          parentActive
            ? "bg-[var(--accent-glow)] text-[var(--accent-600)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-foreground",
        )}
      >
        {parentActive && <ActiveBar collapsed={false} />}
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate">{entry.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {hasTabs ? (
            <Suspense fallback={<SubmenuLinks items={children} isActive={() => false} />}>
              <TabAwareSubmenu items={children} pathname={pathname} />
            </Suspense>
          ) : (
            <SubmenuLinks
              items={children}
              isActive={(item) => current === stripTrailingSlash(item.href)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const { profile, effectiveProfile, signOut } = useAuth();
  // O shell só monta a sidebar no cliente (após o loading de auth), então é
  // seguro ler o localStorage no inicializador — sem flash nem mismatch de SSR.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const canAccess = (roles?: string[]) =>
    !roles || (effectiveProfile && roles.includes(effectiveProfile.tipo));

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccess(item.roles)),
  })).filter((section) => section.items.length > 0);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* localStorage indisponível — mantém apenas o estado em memória */
      }
      return next;
    });
  }

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
    <aside
      className={cn(
        "sticky top-0 z-20 hidden h-dvh shrink-0 flex-col border-r border-[var(--border-subtle)] bg-card transition-[width] duration-300 ease-in-out md:flex",
        collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-[var(--topbar-height)] shrink-0 items-center border-b border-[var(--border-subtle)]",
          collapsed ? "justify-center" : "px-5",
        )}
      >
        <BackofficeLink
          href="/backoffice/dashboard/"
          aria-label="MooviFly Dashboard"
          className="flex min-w-0 items-center gap-2.5"
        >
          <Image
            src="/favicon.png"
            alt="MooviFly"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-[10px]"
          />
          {!collapsed && (
            <span className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
              MooviFly
            </span>
          )}
        </BackofficeLink>
      </div>

      {/* Botão de recolher/expandir, flutuando sobre a borda */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-[calc(var(--topbar-height)-12px)] z-30 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-card text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--border-default)] hover:text-foreground"
      >
        {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Navegação */}
      <nav className={cn("flex-1 py-3", collapsed ? "overflow-visible" : "overflow-y-auto")}>
        {sections.map((section, idx) => (
          <div key={section.label}>
            {collapsed ? (
              idx > 0 && <div className="mx-auto my-2 h-px w-8 bg-[var(--border-subtle)]" />
            ) : (
              <p
                className={cn(
                  "px-6 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]",
                  idx === 0 ? "pt-2" : "pt-5",
                )}
              >
                {section.label}
              </p>
            )}
            <div className={cn("flex flex-col", collapsed ? "gap-1.5 py-1" : "gap-0.5")}>
              {section.items.map((entry) =>
                entry.children?.length ? (
                  <NavGroupItem key={entry.href} entry={entry} pathname={pathname} collapsed={collapsed} />
                ) : (
                  <NavLeafLink
                    key={entry.href}
                    href={entry.href}
                    label={entry.label}
                    icon={entry.icon}
                    active={isEntryActive(pathname, entry)}
                    collapsed={collapsed}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuário + sair */}
      <div className="shrink-0 border-t border-[var(--border-subtle)] p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-9 w-9" title={profile?.nome}>
              <AvatarFallback>{getInitials(profile?.nome ?? "?")}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={handleLogout}
              className="group relative flex h-9 w-11 items-center justify-center rounded-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <ItemTooltip label="Sair" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback>{getInitials(profile?.nome ?? "?")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                {profile?.nome ?? "—"}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--text-secondary)]">
                {profile ? ROLE_LABELS[profile.tipo] ?? profile.tipo : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
