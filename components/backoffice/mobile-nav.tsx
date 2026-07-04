"use client";

import { X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { SidebarBrand, SidebarNav, SidebarUserFooter } from "@/components/backoffice/sidebar";

/** Id do drawer — alvo do aria-controls do botão hambúrguer no Topbar. */
export const MOBILE_NAV_ID = "backoffice-mobile-nav";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** false quando o hook é usado fora do provider — o botão do Topbar não é renderizado. */
  enabled: boolean;
  /** Elemento que abriu o drawer (hambúrguer) — recebe o foco de volta ao fechar. */
  triggerRef?: RefObject<HTMLElement | null>;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

const FALLBACK: MobileNavContextValue = { open: false, setOpen: () => {}, enabled: false };

/** Default seguro: fora do provider retorna no-op com enabled=false, sem quebrar. */
export function useMobileNav(): MobileNavContextValue {
  return useContext(MobileNavContext) ?? FALLBACK;
}

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Captura o disparador de forma síncrona: ao abrir, o conteúdo do shell fica
  // inerte e o navegador já teria removido o foco antes de qualquer effect rodar.
  const setOpen = useCallback((next: boolean) => {
    if (next) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setOpenState(next);
  }, []);

  const value = useMemo(() => ({ open, setOpen, enabled: true, triggerRef }), [open, setOpen]);
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

/**
 * Drawer off-canvas de navegação mobile (<md), com a mesma navegação da
 * sidebar desktop (sempre expandida). Fica montado para animar entrada e
 * saída via translate; fechado, é inerte (fora do foco e dos leitores de tela).
 */
export function MobileNavDrawer() {
  const { open, setOpen, triggerRef } = useMobileNav();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Foco vai para o botão X ao abrir e retorna ao disparador (hambúrguer) ao fechar.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    return () => triggerRef?.current?.focus();
  }, [open, triggerRef]);

  // Escape fecha o drawer.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  // Scroll lock no body enquanto aberto, restaurando ao fechar/desmontar.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Ao cruzar para ≥md (sidebar desktop visível), garante o drawer fechado.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setOpen]);

  return (
    <>
      {/* Overlay — tocar fora fecha */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Drawer */}
      <div
        id={MOBILE_NAV_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[85vw] max-w-[320px] flex-col border-r border-[var(--border-subtle)] bg-card pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo + fechar */}
        <div className="flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] pl-5 pr-2.5">
          <SidebarBrand />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação (sempre expandida no mobile) */}
        <SidebarNav />

        {/* Usuário + sair */}
        <SidebarUserFooter />
      </div>
    </>
  );
}
