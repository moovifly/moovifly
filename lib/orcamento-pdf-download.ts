import { orcamentoPdfInputToDados } from "@/lib/pdf/map-orcamento-input";
import type { OrcamentoPdfInput } from "@/lib/orcamento-pdf-types";

/**
 * Envia os dados para a API e dispara o download do PDF (sem bundlar @react-pdf no cliente).
 */
export async function downloadOrcamentoPdf(input: OrcamentoPdfInput, filename: string) {
  const dados = orcamentoPdfInputToDados(input);
  const res = await fetch("/api/orcamento/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });

  if (!res.ok) {
    let msg = "Falha ao gerar PDF";
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
