"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { MobileNavDrawer, MobileNavProvider, useMobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

const PROFILE_WAIT_MS = 30_000;

export function BackofficeShell({ children }: { children: ReactNode }) {
  const { loading, profile, userId } = useAuth();
  const [profileWaitExceeded, setProfileWaitExceeded] = useState(false);

  useEffect(() => {
    if (!userId || profile) {
      setProfileWaitExceeded(false);
      return;
    }
    const t = setTimeout(() => setProfileWaitExceeded(true), PROFILE_WAIT_MS);
    return () => clearTimeout(t);
  }, [userId, profile]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-600)]" />
      </div>
    );
  }

  if (userId && !profile) {
    if (profileWaitExceeded) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Não foi possível validar sua sessão. Verifique sua conexão com a internet e tente entrar novamente.
          </p>
          <a
            href="/backoffice/login/"
            className="text-sm font-medium text-[var(--accent-600)] underline-offset-4 hover:underline"
          >
            Ir para o login
          </a>
        </div>
      );
    }
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-600)]" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <MobileNavProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <MobileNavDrawer />
        <ShellContent>{children}</ShellContent>
      </div>
    </MobileNavProvider>
  );
}

/** Conteúdo principal — fica inerte (sem foco/interação) enquanto o menu mobile está aberto. */
function ShellContent({ children }: { children: ReactNode }) {
  const { open } = useMobileNav();
  return (
    <div inert={open} className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
