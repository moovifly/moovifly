"use client";

import { getSupabaseClient, resetSupabaseClient } from "@/lib/supabase/client";
import { applyBrowserAuthSession, clearBrowserAuthSession } from "@/lib/supabase/browser-session";

export type UserProfile = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo: "administrador" | "gerente" | "vendedor" | string;
  ativo: boolean;
  [key: string]: unknown;
};

export async function signIn(email: string, password: string) {
  try {
    const res = await fetch("/api/auth/sign-in/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as {
      user: Record<string, unknown> | null;
      access_token?: string | null;
      refresh_token?: string | null;
      expires_in?: number;
      expires_at?: number;
      token_type?: string;
      error: string | null;
    };

    if (!res.ok || json.error) {
      return {
        data: { user: null, session: null },
        error: { message: json.error ?? `HTTP ${res.status}` },
      };
    }

    const session =
      json.access_token && json.refresh_token && json.user
        ? {
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            expires_in: json.expires_in,
            expires_at: json.expires_at,
            token_type: json.token_type,
            user: json.user,
          }
        : null;

    if (session) {
      applyBrowserAuthSession(session);
      resetSupabaseClient();
    }

    return {
      data: {
        user: json.user as { id: string; email?: string | null } | null,
        session,
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      data: { user: null, session: null },
      error: { message },
    };
  }
}

export async function signOut() {
  try {
    const res = await fetch("/api/auth/sign-out/", {
      method: "POST",
      credentials: "include",
    });
    const json = (await res.json()) as { error: string | null };
    if (!res.ok && json.error) {
      return { error: { message: json.error } };
    }
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: { message } };
  }
}

/** Limpa sessão local sem chamar GoTrue — útil quando a rede bloqueia o Supabase. */
export async function signOutLocal() {
  clearBrowserAuthSession();
  resetSupabaseClient();
  try {
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } catch {
    /* ignore */
  }
}

/** Tenta sign-out remoto; se falhar (rede), remove sessão local mesmo assim. */
export async function signOutSafe() {
  try {
    await signOut();
  } catch {
    await signOutLocal();
  }
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}

export async function getSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

/** Lê sessão via API do Next (servidor renova token) — preferir no boot do backoffice. */
export async function fetchSessionFromServer(): Promise<{
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
}> {
  try {
    const res = await fetch("/api/auth/session/", {
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json()) as {
      userId: string | null;
      user?: Record<string, unknown> | null;
      access_token?: string | null;
      refresh_token?: string | null;
      expires_in?: number;
      expires_at?: number;
      token_type?: string;
    };
    return {
      userId: json.userId ?? null,
      accessToken: json.access_token ?? null,
      refreshToken: json.refresh_token ?? null,
      user: json.user ?? null,
      expiresIn: json.expires_in,
      expiresAt: json.expires_at,
      tokenType: json.token_type,
    };
  } catch {
    return {
      userId: null,
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }
}

/** Sincroniza JWT no browser a partir dos cookies do servidor — sem /auth/v1/user. */
export async function syncBrowserSessionFromServer(): Promise<string | null> {
  const { userId, accessToken, refreshToken, user, expiresIn, expiresAt, tokenType } =
    await fetchSessionFromServer();
  if (accessToken && refreshToken && user) {
    applyBrowserAuthSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: tokenType,
      user,
    });
    resetSupabaseClient();
  }
  return userId;
}

export async function getSessionUserIdFromServer(): Promise<string | null> {
  const { userId } = await fetchSessionFromServer();
  return userId;
}

export async function getUserProfile(userId: string) {
  try {
    const res = await fetch("/api/profile/", {
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json()) as {
      data: UserProfile | null;
      error: string | null;
    };

    if (!res.ok) {
      return {
        data: null,
        error: new Error(json.error || `HTTP ${res.status}`),
      };
    }

    if (json.data && json.data.user_id !== userId) {
      return {
        data: null,
        error: new Error("session_profile_mismatch"),
      };
    }

    return {
      data: json.data,
      error: json.error ? new Error(json.error) : null,
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { data: null, error: err };
  }
}

export const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  vendedor: "Vendedor",
  gerente: "Gerente",
};
