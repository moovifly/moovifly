import { NextResponse, type NextRequest } from "next/server";

import { fetchFluxoCaixaData } from "@/lib/financial/fluxo-caixa";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "Parâmetros start e end são obrigatórios." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "no_session" }, { status: 401 });
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("tipo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!usuario || !["administrador", "gerente"].includes(usuario.tipo)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const payload = await fetchFluxoCaixaData(supabase, start, end);
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
