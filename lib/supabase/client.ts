"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Recria o client após gravar sessão no localStorage. */
export function resetSupabaseClient() {
  client = null;
}

function resolveSupabaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    return `${window.location.origin}/api/supabase-proxy`;
  }
  return configured;
}

export function getSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("[supabase] getSupabaseClient() só pode ser usado no browser.");
  }

  if (!client) {
    const url = resolveSupabaseUrl();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.error(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no build. Confira Environment Variables na Vercel.",
      );
    }
    client = createBrowserClient(url, anon!, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        // Em dev local o refresh no browser passa pelo proxy e falha; sessão vem do servidor.
        autoRefreshToken: process.env.NODE_ENV !== "development",
      },
    });
  }
  return client;
}

/** URL base para REST/Auth/Functions — em dev local usa proxy same-origin. */
export function getSupabasePublicUrl(): string {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    return `${window.location.origin}/api/supabase-proxy`;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
}
