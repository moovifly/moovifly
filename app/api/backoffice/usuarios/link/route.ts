import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TIPOS = new Set(["administrador", "gerente", "vendedor"]);

type Body = {
  nome?: string;
  email?: string;
  tipo?: string;
  ativo?: boolean;
  comissao_percentual?: number;
};

/** Localiza auth.users pelo e-mail (paginado). Uso administrativo, base pequena. */
async function findAuthUserIdByEmail(admin: SupabaseClient, emailNorm: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === emailNorm);
    if (hit?.id) return hit.id;
    if (users.length < perPage) break;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const { data: me, error: profileError } = await supabase
      .from("usuarios")
      .select("tipo, ativo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !me || me.tipo !== "administrador" || !me.ativo) {
      return NextResponse.json({ error: "Apenas administradores podem vincular usuários." }, { status: 403 });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
    const tipo = typeof body.tipo === "string" ? body.tipo : "";
    const ativo = body.ativo !== false;
    const comissao_percentual = typeof body.comissao_percentual === "number" ? body.comissao_percentual : 0;

    if (!nome || !emailRaw) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
    }
    if (!TIPOS.has(tipo)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }

    const emailNorm = emailRaw.toLowerCase();
    const admin = createAdminClient();

    const { data: dupEmail } = await admin.from("usuarios").select("id").eq("email", emailNorm).maybeSingle();
    if (dupEmail) {
      return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
    }

    let authUserId: string | null;
    try {
      authUserId = await findAuthUserIdByEmail(admin, emailNorm);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!authUserId) {
      return NextResponse.json(
        {
          error:
            "Nenhum usuário encontrado no Auth com este e-mail. Crie em Authentication → Users ou use convite por e-mail.",
        },
        { status: 404 },
      );
    }

    const { data: dupUid } = await admin.from("usuarios").select("id").eq("user_id", authUserId).maybeSingle();
    if (dupUid) {
      return NextResponse.json(
        { error: "Este login (Auth) já está vinculado a um usuário do backoffice." },
        { status: 409 },
      );
    }

    const { error: insertError } = await admin.from("usuarios").insert({
      user_id: authUserId,
      nome,
      email: emailNorm,
      tipo,
      ativo,
      comissao_percentual,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
