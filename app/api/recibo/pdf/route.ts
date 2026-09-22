import { NextRequest, NextResponse } from "next/server";

import { gerarReciboPdfBuffer } from "@/lib/pdf/gerar-recibo-pdf";
import { vendaToDadosRecibo, type VendaReciboRow } from "@/lib/pdf/map-recibo";
import type { ReciboPagante } from "@/lib/pdf/recibo-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function parsePagante(raw: unknown): ReciboPagante | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (k: string) => String(o[k] ?? "").trim();
  const nome = str("nome");
  if (!nome) return null;
  return {
    nome,
    endereco: str("endereco"),
    bairro: str("bairro"),
    cidade: str("cidade"),
    uf: str("uf"),
    cep: str("cep"),
    cpfCnpj: str("cpfCnpj"),
    ieRg: str("ieRg"),
    telefones: str("telefones"),
    email: str("email"),
  };
}

export async function POST(req: NextRequest) {
  let body: { vendaId?: string; pagante?: unknown };
  try {
    body = (await req.json()) as { vendaId?: string; pagante?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const vendaId = body.vendaId?.trim();
  if (!vendaId) {
    return NextResponse.json({ error: "vendaId é obrigatório" }, { status: 400 });
  }

  const paganteOverride = body.pagante !== undefined ? parsePagante(body.pagante) : undefined;
  if (body.pagante !== undefined && !paganteOverride) {
    return NextResponse.json(
      { error: "Informe o nome do pagante" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, tipo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 403 });
  }

  let q = supabase
    .from("vendas")
    .select(
      "id, numero_venda, data_venda, categoria_venda, tipo, origem, destino, companhia, localizador, voucher, data_ida, data_volta, valor_total, taxa_rav, taxa_du, forma_pagamento, voos, passageiros_dados, vendedor_id, cliente:clientes(nome, email, telefone, cpf, rg, endereco, cidade, estado, cep)",
    )
    .eq("id", vendaId);

  if (usuario.tipo === "vendedor") {
    q = q.eq("vendedor_id", usuario.id);
  }

  const { data: venda, error: vendaError } = await q.maybeSingle();

  if (vendaError) {
    return NextResponse.json({ error: vendaError.message }, { status: 500 });
  }
  if (!venda) {
    return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
  }

  try {
    const dados = vendaToDadosRecibo(venda as unknown as VendaReciboRow, {
      paganteOverride: paganteOverride ?? null,
    });
    const pdfBuffer = await gerarReciboPdfBuffer(dados);
    const numero = (venda.numero_venda ?? "recibo").replace(/[^\w.-]+/g, "_");
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Recibo-${numero}.pdf"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao gerar PDF" }, { status: 500 });
  }
}
