import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextParam(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/backoffice/definir-senha/";
  }
  return next;
}

/**
 * Troca o código PKCE do e-mail de convite (ou magic link) por sessão e redireciona.
 * O `redirect_to` no Supabase deve incluir esta URL na lista de URLs permitidas.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextParam(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/backoffice/login/?erro=auth`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/backoffice/login/?erro=auth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
