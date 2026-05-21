"use client";

/** Grava sessão no localStorage no formato do Supabase Auth — sem chamar /auth/v1/user (evita 502 no proxy). */
export function applyBrowserAuthSession(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;

  let ref: string;
  try {
    ref = new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return;
  }
  if (!ref) return;

  const expiresIn = session.expires_in ?? 3600;
  const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + expiresIn;

  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: session.token_type ?? "bearer",
    user: session.user,
  };

  try {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearBrowserAuthSession() {
  if (typeof window === "undefined") return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    if (ref) localStorage.removeItem(`sb-${ref}-auth-token`);
  } catch {
    /* ignore */
  }
}
