"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Recria o client após gravar sessão no localStorage. */
export function resetSupabaseClient() {
  client = null;
}

/** No browser, sempre same-origin: evita ERR_CONNECTION_RESET direto em *.supabase.co. */
function resolveSupabaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/supabase-proxy`;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
        // Refresh via proxy same-origin (servidor Vercel fala com Supabase).
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

/** URL base para REST/Auth/Functions no browser (proxy same-origin). */
export function getSupabasePublicUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/supabase-proxy`;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
}
