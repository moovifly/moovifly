"use client";

import { useEffect } from "react";

/**
 * O Supabase pode devolver convite/confirmar com `?code=` ou com tokens no `#hash`
 * na URL configurada do site (às vezes a raiz). O fragmento não chega ao servidor.
 * Redireciona para `/auth/callback` no cliente para concluir a sessão e ir definir senha.
 */
export function AuthHashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { pathname, search, hash, origin } = window.location;
    if (pathname.startsWith("/auth/callback")) return;

    const hasHashTokens = hash.includes("access_token");
    const params = new URLSearchParams(search);
    const hasCode = Boolean(params.get("code"));

    if (!hasHashTokens && !hasCode) return;

    window.location.replace(`${origin}/auth/callback${search}${hash}`);
  }, []);

  return null;
}
