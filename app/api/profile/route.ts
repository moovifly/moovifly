import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lê `public.usuarios` no servidor com o JWT dos cookies (mesma sessão do browser).
 * Evita fetch direto do cliente ao PostgREST em redes onde o pedido cross-origin fica pendente.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: "no_session" },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
