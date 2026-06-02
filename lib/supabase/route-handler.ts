import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseFetch } from "@/lib/supabase/curl-fetch";

/**
 * Cliente Supabase para Route Handlers com cookies gravados na resposta HTTP.
 * Garante Set-Cookie no sign-in/sign-out (cookieStore.set sozinho pode não ir ao browser).
 */
export async function createRouteHandlerSupabase() {
  const cookieStore = await cookies();
  let pendingCookies = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: supabaseFetch,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              pendingCookies.cookies.set(name, value, options);
            });
          } catch {
            /* refresh em contexto read-only */
          }
        },
      },
    },
  );

  function jsonWithAuthCookies<T extends Record<string, unknown>>(
    body: T,
    init?: { status?: number },
  ) {
    const res = NextResponse.json(body, { status: init?.status ?? 200 });
    pendingCookies.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie);
    });
    return res;
  }

  return { supabase, jsonWithAuthCookies };
}
