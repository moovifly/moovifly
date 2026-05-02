"use client";

import { getSupabaseClient } from "@/lib/supabase/client";

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
  const supabase = getSupabaseClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = getSupabaseClient();
  return supabase.auth.signOut();
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

export async function getUserProfile(userId: string) {
  try {
    const res = await fetch("/api/profile", {
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
