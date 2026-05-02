"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

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
      auth: {
        // GoTrue (auth-js): libera lock órfão mais cedo; tipos do pacote podem não expor ainda.
        // @ts-expect-error — suportado em runtime por @supabase/auth-js
        lockAcquireTimeout: 2500,
      },
    });
  }
  return client;
}
