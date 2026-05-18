"use client";

import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  MOOVIFLY_PASSWORD_RECOVERY_KEY,
  MOOVIFLY_POS_CONVITE_KEY,
} from "@/lib/auth-invite-flow";
import { establishSessionFromUrl } from "@/lib/auth-session-from-url";
import {
  loginQueryForAuthError,
  messageForAuthUrlError,
  parseAuthErrorFromUrl,
} from "@/lib/auth-url-errors";
import { getSupabaseClient } from "@/lib/supabase/client";
import { publicUrlForPath } from "@/lib/public-site-url";

const DEFAULT_NEXT = "/backoffice/definir-senha/";

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  return next.endsWith("/") ? next : `${next}/`;
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

      const urlError = parseAuthErrorFromUrl();
      if (urlError) {
        const msg = messageForAuthUrlError(urlError);
        setStatus(msg);
        setTimeout(() => {
          window.location.replace(
            publicUrlForPath(`/backoffice/login/?erro=${loginQueryForAuthError(urlError)}`),
          );
        }, 4500);
        return;
      }

      try {
        const flow =
          code || (typeof window !== "undefined" && window.location.hash?.includes("access_token"))
            ? await establishSessionFromUrl(supabase)
            : "none";

        if (flow === "none") {
          setStatus("Link inválido ou expirado. Solicite um novo e-mail de recuperação.");
          setTimeout(() => {
            window.location.replace(publicUrlForPath("/backoffice/login/?erro=auth"));
          }, 3500);
          return;
        }

        if (cancelled) return;

        try {
          if (flow === "recovery") {
            sessionStorage.setItem(MOOVIFLY_PASSWORD_RECOVERY_KEY, "1");
          } else {
            sessionStorage.setItem(MOOVIFLY_POS_CONVITE_KEY, "1");
          }
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
