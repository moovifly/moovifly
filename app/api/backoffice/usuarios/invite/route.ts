import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { publicUrlForPath } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

const TIPOS = new Set(["administrador", "gerente", "vendedor"]);

type Body = {
  nome?: string;
  email?: string;
  tipo?: string;
  ativo?: boolean;
};

function resolveRedirectTo(request: Request): string {
  const nextPath = "/backoffice/definir-senha/";
  const qp = new URLSearchParams({ next: nextPath });
  const path = `/auth/callback?${qp.toString()}`;

  const origin = request.headers.get("origin")?.replace(/\/$/, "");
  if (origin) return `${origin}${path}`;

  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (envBase) {
    const base = envBase.startsWith("http") ? envBase : `https://${envBase}`;
    return `${base}${path}`;
  }

  return publicUrlForPath(path);
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
      return NextResponse.json({ error: "Apenas administradores podem convidar usuários." }, { status: 403 });
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

    if (!nome || !emailRaw) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
    }
    if (!TIPOS.has(tipo)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }

    const emailNorm = emailRaw.toLowerCase();
    const redirectTo = resolveRedirectTo(request);

    const admin = createAdminClient();

    const { data: dup } = await admin.from("usuarios").select("id").eq("email", emailNorm).maybeSingle();
    if (dup) {
      return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(emailNorm, {
      redirectTo,
      data: { nome },
    });

    if (inviteError) {
      const msg = inviteError.message ?? "Falha ao enviar convite.";
      const friendly =
        msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered")
          ? "Este e-mail já está cadastrado no sistema de autenticação."
          : msg;
      return NextResponse.json({ error: friendly }, { status: 400 });
    }

    const invitedId = invited?.user?.id;
    if (!invitedId) {
      return NextResponse.json({ error: "Convite não retornou o identificador do usuário." }, { status: 500 });
    }

    const { error: insertError } = await admin.from("usuarios").insert({
      user_id: invitedId,
      nome,
      email: emailNorm,
      tipo,
      ativo,
    });

    if (insertError) {
      await admin.auth.admin.deleteUser(invitedId);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
