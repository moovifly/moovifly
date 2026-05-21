import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Login no servidor — grava cookies da sessão sem o browser falar direto com GoTrue. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { user: null, error: "E-mail e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ user: null, error: error.message }, { status: 401 });
    }

    const session = data.session;
    if (!session?.user) {
      return NextResponse.json({ user: null, error: "Não foi possível autenticar usuário." }, { status: 401 });
    }

    return NextResponse.json({
      user: session.user,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ user: null, error: message }, { status: 500 });
  }
}
