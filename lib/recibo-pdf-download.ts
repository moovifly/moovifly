/**
 * Solicita o PDF do recibo da venda e dispara o download no browser.
 */
export async function downloadReciboPdf(vendaId: string, filename: string) {
  const res = await fetch("/api/recibo/pdf/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vendaId }),
  });

  if (!res.ok) {
    let msg = "Falha ao gerar recibo";
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
