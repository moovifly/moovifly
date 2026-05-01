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
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return { data: data as UserProfile | null, error };
}

export const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  vendedor: "Vendedor",
  gerente: "Gerente",
};
