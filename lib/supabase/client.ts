"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Recria o client após gravar sessão no localStorage. */
export function resetSupabaseClient() {
  client = null;
}

function getSupabaseProjectUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    console.error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL ausente no build. Confira Environment Variables na Vercel.",
    );
    return "";
  }
  return url.replace(/\/$/, "");
}

/**
 * Pedidos Auth/REST passam pelo proxy same-origin; o client usa a URL do projeto
 * para nomes de cookie (`sb-<ref>-auth-token`) iguais aos do servidor (@supabase/ssr).
 */
function proxySupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const projectBase = getSupabaseProjectUrl();
  if (!projectBase || typeof window === "undefined") {
    return fetch(input, init);
  }

  const proxyBase = `${window.location.origin}/api/supabase-proxy`;

  let url: string;
  if (typeof input === "string") url = input;
  else if (input instanceof URL) url = input.href;
  else url = input.url;

  if (url.startsWith(projectBase)) {
    url = proxyBase + url.slice(projectBase.length);
  }

  return fetch(url, init);
}

export function getSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("[supabase] getSupabaseClient() só pode ser usado no browser.");
  }

  if (!client) {
    const url = getSupabaseProjectUrl();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.error(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no build. Confira Environment Variables na Vercel.",
      );
    }
    client = createBrowserClient(url, anon!, {
      global: {
        fetch: proxySupabaseFetch,
      },
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
  return getSupabaseProjectUrl();
}
