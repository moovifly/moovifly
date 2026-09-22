import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { ReciboPdfDocument } from "@/lib/pdf/recibo-document";
import type { DadosRecibo } from "@/lib/pdf/recibo-types";

/** Gera o PDF do recibo no servidor (API Route). */
export async function gerarReciboPdfBuffer(dados: DadosRecibo): Promise<Buffer> {
  return renderToBuffer(<ReciboPdfDocument dados={dados} />);
}
