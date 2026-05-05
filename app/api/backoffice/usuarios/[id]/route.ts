import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Remove o perfil em `public.usuarios` e o usuário em `auth.users` (via Admin API).
 * Desvincula vendas/orçamentos/clientes/comissões/atividades antes para evitar erro de FK.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params;
    const targetProfileId = rawId?.trim() ?? "";
    if (!UUID_RE.test(targetProfileId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

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
      .select("id, tipo, ativo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !me || me.tipo !== "administrador" || !me.ativo) {
      return NextResponse.json({ error: "Apenas administradores podem excluir usuários." }, { status: 403 });
    }

    if (me.id === targetProfileId) {
      return NextResponse.json({ error: "Você não pode excluir a si mesmo." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: target, error: targetError } = await admin
      .from("usuarios")
      .select("id, user_id, nome, email")
      .eq("id", targetProfileId)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const { error: e1 } = await admin.from("orcamentos").update({ vendedor_id: null }).eq("vendedor_id", targetProfileId);
    if (e1) return NextResponse.json({ error: `Orçamentos: ${e1.message}` }, { status: 500 });

    const { error: e2 } = await admin.from("vendas").update({ vendedor_id: null }).eq("vendedor_id", targetProfileId);
    if (e2) return NextResponse.json({ error: `Vendas: ${e2.message}` }, { status: 500 });

    const { error: e3 } = await admin.from("clientes").update({ vendedor_id: null }).eq("vendedor_id", targetProfileId);
    if (e3) return NextResponse.json({ error: `Clientes: ${e3.message}` }, { status: 500 });

    const { error: e4 } = await admin.from("comissoes").update({ usuario_id: null }).eq("usuario_id", targetProfileId);
    if (e4) return NextResponse.json({ error: `Comissões: ${e4.message}` }, { status: 500 });

    const { error: e5 } = await admin.from("atividades").update({ usuario_id: null }).eq("usuario_id", targetProfileId);
    if (e5) return NextResponse.json({ error: `Atividades: ${e5.message}` }, { status: 500 });

    const authId = target.user_id;
    if (authId) {
      const { error: delAuthError } = await admin.auth.admin.deleteUser(authId);
      if (delAuthError) {
        return NextResponse.json({ error: delAuthError.message }, { status: 500 });
      }
    } else {
      const { error: delRowError } = await admin.from("usuarios").delete().eq("id", targetProfileId);
      if (delRowError) {
        return NextResponse.json({ error: delRowError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
