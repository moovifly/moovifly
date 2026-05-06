import { NextRequest, NextResponse } from "next/server";

import { gerarOrcamentoPdfBuffer } from "@/lib/pdf/gerar-orcamento-pdf";
import type { DadosOrcamento } from "@/lib/pdf/orcamento-types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let dados: DadosOrcamento;
  try {
    dados = (await req.json()) as DadosOrcamento;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!dados?.agencia || !dados.voos || !Array.isArray(dados.formasPagamento)) {
    return NextResponse.json({ error: "Payload incompleto" }, { status: 400 });
  }

  try {
    const pdfBuffer = await gerarOrcamentoPdfBuffer(dados);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="orcamento.pdf"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao gerar PDF" }, { status: 500 });
  }
}
