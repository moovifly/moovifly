"use client";

import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MOOVIFLY_POS_CONVITE_KEY } from "@/lib/auth-invite-flow";
import { getSupabaseClient } from "@/lib/supabase/client";
import { publicUrlForPath } from "@/lib/public-site-url";

const DEFAULT_NEXT = "/backoffice/definir-senha/";

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  return next.endsWith("/") ? next : `${next}/`;
}

async function waitForSessionFromHash(
  maxAttempts = 20,
  delayMs = 100,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  for (let i = 0; i < maxAttempts; i++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Confirmando o convite…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = getSupabaseClient();
      const next = safeNext(searchParams.get("next"));
      const code = searchParams.get("code");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (typeof window !== "undefined" && window.location.hash?.includes("access_token")) {
          setStatus("Carregando sessão…");
          const ok = await waitForSessionFromHash();
          if (!ok) {
            throw new Error(
              "Não foi possível ativar a sessão a partir do link. Abra o convite no mesmo navegador ou solicite um novo e-mail.",
            );
          }
        } else {
          setStatus("Link inválido ou expirado.");
          setTimeout(() => {
            window.location.replace(publicUrlForPath("/backoffice/login/?erro=auth"));
          }, 2000);
          return;
        }

        if (cancelled) return;

        try {
          sessionStorage.setItem(MOOVIFLY_POS_CONVITE_KEY, "1");
        } catch {
          /* ignore */
        }

        window.location.replace(publicUrlForPath(next));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(msg);
        setTimeout(() => {
          window.location.replace(publicUrlForPath("/backoffice/login/?erro=auth"));
        }, 3500);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
      <p className="max-w-md text-center text-sm text-muted-foreground">{status}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center p-6">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
