"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

const FETCH_TIMEOUT_MS = 25_000;

/** Evita fetch ao PostgREST/GoTrue pendurado sem Abort (alguns browsers/rede deixam a Promise aberta). */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export function getSupabaseClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.error(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no build. Confira Environment Variables na Vercel.",
      );
    }
    client = createBrowserClient(url!, anon!, {
      global: {
        fetch: fetchWithTimeout,
      },
      auth: {
        // GoTrue (auth-js): libera lock órfão mais cedo; tipos do pacote podem não expor ainda.
        // @ts-expect-error — suportado em runtime por @supabase/auth-js
        lockAcquireTimeout: 2500,
      },
    });
  }
  return client;
}
