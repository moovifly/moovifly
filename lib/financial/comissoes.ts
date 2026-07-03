import { formatDate } from "@/lib/format";

export type Comissao = {
  id: string;
  venda_id: string | null;
  vendedor_id?: string | null;
  valor_venda: number | string;
  base_calculo: number | string | null;
  percentual_comissao: number | string;
  valor_comissao: number | string;
  status: string;
  data_pagamento: string | null;
  created_at?: string;
  usuarios?: { nome: string } | { nome: string }[] | null;
  vendas?: { numero_venda: string | null; descricao: string | null; data_venda: string | null } | null;
};

export type ComissaoAgrupada = {
  key: string;
  vendedorId: string;
  vendedorNome: string;
  mesKey: string;
  mesLabel: string;
  quantidade: number;
  total: number;
  comissaoIds: string[];
};

export const COMISSAO_BADGE = {
  paga: "bg-[var(--success-bg)] text-[var(--success-text)]",
  cancelada: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
};

export function vendorName(c: Comissao): string {
  const usr = Array.isArray(c.usuarios) ? c.usuarios[0] : c.usuarios;
  return usr?.nome ?? "—";
}

export function saleLabel(c: Comissao): string {
  const v = c.vendas;
  if (!v) return "—";
  const parts = [v.numero_venda ? `#${v.numero_venda}` : null, v.descricao].filter(Boolean);
  return parts.join(" · ") || "—";
}

export function saleDate(c: Comissao): string {
  const data = c.vendas?.data_venda;
  return data ? formatDate(data) : "—";
}

function monthKeyFromDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "sem-data";
  return dateStr.slice(0, 7);
}

function monthLabelFromKey(mesKey: string): string {
  if (mesKey === "sem-data") return "Sem data";
  return new Date(`${mesKey}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

/** Mês de referência: data da venda ou created_at para comissões manuais. */
export function comissaoMesKey(c: Comissao): string {
  if (c.vendas?.data_venda) return monthKeyFromDate(c.vendas.data_venda);
  return monthKeyFromDate(c.created_at ?? null);
}

export function comissaoPagamentoMesKey(c: Comissao): string {
  return monthKeyFromDate(c.data_pagamento);
}

function agrupar(
  comissoes: Comissao[],
  getMesKey: (c: Comissao) => string,
): ComissaoAgrupada[] {
  const map = new Map<string, ComissaoAgrupada>();

  for (const c of comissoes) {
    const vendedorId = c.vendedor_id ?? "sem-vendedor";
    const mesKey = getMesKey(c);
    const key = `${vendedorId}:${mesKey}`;
    const valor = Number(c.valor_comissao ?? 0);
    const existing = map.get(key);

    if (existing) {
      existing.quantidade += 1;
      existing.total += valor;
      existing.comissaoIds.push(c.id);
    } else {
      map.set(key, {
        key,
        vendedorId,
        vendedorNome: vendorName(c),
        mesKey,
        mesLabel: monthLabelFromKey(mesKey),
        quantidade: 1,
        total: valor,
        comissaoIds: [c.id],
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.mesKey !== b.mesKey) return b.mesKey.localeCompare(a.mesKey);
    return a.vendedorNome.localeCompare(b.vendedorNome, "pt-BR");
  });
}

export function agruparComissoesPorVendedorMes(comissoes: Comissao[]): ComissaoAgrupada[] {
  return agrupar(comissoes, comissaoMesKey);
}

export function agruparComissoesPagasPorVendedorMes(comissoes: Comissao[]): ComissaoAgrupada[] {
  return agrupar(comissoes, comissaoPagamentoMesKey);
}
