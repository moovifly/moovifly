/** Formas de pagamento que geram taxa de cartão na comissão aérea. */
export const FORMAS_CARTAO_COMISSAO = new Set([
  "1x Cartão de Crédito",
  "Parcelado Cartão de Crédito",
  "Pix + Cartão de Crédito",
]);

/** Percentual de taxa de cartão sobre RAV+DU (mesmo mapa do trigger de comissão). */
export const TAXA_CARTAO_COMISSAO: Record<string, number> = {
  BRT: 0.0399,
  MaisFly: 0.0399,
  Sakura: 0.0399,
};

export type VendaComissaoEmpresa = {
  id: string;
  categoria_venda?: string | null;
  valor_total?: number | string | null;
  taxa_rav?: number | string | null;
  taxa_du?: number | string | null;
  forma_pagamento?: string | null;
  fornecedor?: string | null;
  status?: string | null;
  seguro_promocional?: boolean | null;
};

/** Repasse da consolidadora no Seguro Viagem: 40% do valor total (50% se promocional). */
export function percentualRepasseSeguro(promocional: boolean | null | undefined): number {
  return promocional ? 0.5 : 0.4;
}

export type ComissaoVendedorEmpresa = {
  venda_id?: string | null;
  valor_comissao?: number | string | null;
  status?: string | null;
};

export type ComissaoEmpresaResumo = {
  bruto: number;
  taxas: number;
  liquidoAposTaxas: number;
  vendedores: number;
  empresa: number;
  percentualEmpresa: number;
  vendasConsideradas: number;
};

export const EMPTY_COMISSAO_EMPRESA: ComissaoEmpresaResumo = {
  bruto: 0,
  taxas: 0,
  liquidoAposTaxas: 0,
  vendedores: 0,
  empresa: 0,
  percentualEmpresa: 0,
  vendasConsideradas: 0,
};

function n(value: number | string | null | undefined): number {
  const num = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isVendaConfirmada(status: string | null | undefined): boolean {
  return status === "confirmada" || status === "concluida";
}

/** Comissão bruta da agência e taxa de cartão de uma venda, no mesmo critério do trigger. */
export function comissaoBrutaETaxa(venda: VendaComissaoEmpresa): { bruto: number; taxa: number } {
  if (venda.categoria_venda === "seguro_viagem") {
    return { bruto: round2(n(venda.valor_total) * percentualRepasseSeguro(venda.seguro_promocional)), taxa: 0 };
  }

  const bruto = round2(n(venda.taxa_rav) + n(venda.taxa_du));
  if (venda.categoria_venda === "servico") {
    return { bruto, taxa: 0 };
  }

  const fornecedor = (venda.fornecedor ?? "").trim();
  const forma = venda.forma_pagamento ?? "";
  const aliquota = TAXA_CARTAO_COMISSAO[fornecedor];
  if (aliquota && FORMAS_CARTAO_COMISSAO.has(forma)) {
    return { bruto, taxa: round2(bruto * aliquota) };
  }

  return { bruto, taxa: 0 };
}

export function aggregateComissaoEmpresa(
  vendas: VendaComissaoEmpresa[],
  comissoes: ComissaoVendedorEmpresa[],
): ComissaoEmpresaResumo {
  const sellerByVenda = new Map<string, number>();
  for (const c of comissoes) {
    if (!c.venda_id || c.status === "cancelada") continue;
    sellerByVenda.set(c.venda_id, (sellerByVenda.get(c.venda_id) ?? 0) + n(c.valor_comissao));
  }

  let bruto = 0;
  let taxas = 0;
  let vendedores = 0;
  let vendasConsideradas = 0;

  for (const venda of vendas) {
    if (!isVendaConfirmada(venda.status)) continue;
    const split = comissaoBrutaETaxa(venda);
    if (split.bruto === 0 && split.taxa === 0 && !sellerByVenda.has(venda.id)) continue;

    bruto += split.bruto;
    taxas += split.taxa;
    vendedores += sellerByVenda.get(venda.id) ?? 0;
    vendasConsideradas += 1;
  }

  bruto = round2(bruto);
  taxas = round2(taxas);
  vendedores = round2(vendedores);
  const liquidoAposTaxas = round2(bruto - taxas);
  const empresa = round2(liquidoAposTaxas - vendedores);
  const percentualEmpresa = liquidoAposTaxas > 0 ? (empresa / liquidoAposTaxas) * 100 : 0;

  return {
    bruto,
    taxas,
    liquidoAposTaxas,
    vendedores,
    empresa,
    percentualEmpresa,
    vendasConsideradas,
  };
}
