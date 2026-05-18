"use client";

import { useEffect } from "react";

import { authCallbackRedirectUrl, DEFINIR_SENHA_PATH } from "@/lib/auth-redirect-urls";

function canonicalOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) return null;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

function isRecoveryFlow(search: string, hash: string): boolean {
  if (hash.includes("type=recovery")) return true;
  const params = new URLSearchParams(search);
  return params.get("type") === "recovery";
}

/**
 * Links de convite/recuperação do Supabase costumam cair na raiz do Site URL (ex.: moovifly.com).
 * O fragmento (#access_token) não chega ao middleware — redirecionamos no cliente para /auth/callback.
 * Se o host for apex (moovifly.com) e o canónico for www, repassamos tokens para www antes do callback.
 */
export function AuthHashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { pathname, search, hash, origin, hostname } = window.location;
    if (pathname.startsWith("/auth/callback")) return;

    const hasHashTokens = hash.includes("access_token");
    const params = new URLSearchParams(search);
    const hasCode = Boolean(params.get("code"));

    if (!hasHashTokens && !hasCode) return;

    const recovery = isRecoveryFlow(search, hash);
    const nextPath = recovery ? DEFINIR_SENHA_PATH : params.get("next") ?? DEFINIR_SENHA_PATH;
    const callbackAbsolute = authCallbackRedirectUrl(
      nextPath.startsWith("/") ? nextPath : `/${nextPath}`,
    );

    const canonical = canonicalOrigin();
    if (canonical && hostname === "moovifly.com") {
      const dest = new URL(callbackAbsolute);
      dest.hash = hash;
      if (hasCode && !dest.search.includes("code=")) {
        dest.search = search;
      }
      window.location.replace(dest.toString());
      return;
    }

    const callback = new URL(
      recovery ? callbackAbsolute : `${origin}/auth/callback${search}`,
    );
    if (recovery && !callback.search.includes("next=")) {
      callback.search = new URLSearchParams({ next: DEFINIR_SENHA_PATH }).toString();
    }
    callback.hash = hash;
    window.location.replace(callback.toString());
  }, []);

  return null;
}
