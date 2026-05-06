import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { OrcamentoPdfDocument } from "@/lib/pdf/orcamento-document";
import type { DadosOrcamento } from "@/lib/pdf/orcamento-types";

/** Gera o PDF no formato SPEC (Node / API Route apenas). */
export async function gerarOrcamentoPdfBuffer(dados: DadosOrcamento): Promise<Buffer> {
  return renderToBuffer(<OrcamentoPdfDocument dados={dados} />);
}
