import { monthLabelFromKey, monthsInRange } from "@/lib/financial/fluxo-caixa";

export type ReceitaRow = {
  valor: number | string;
  data_recebimento: string;
  forma_pagamento: string | null;
};

export type DespesaRow = {
  valor: number | string;
  data_pagamento: string;
  categoria: string | null;
};

export type RelatorioMensalRow = {
  monthKey: string;
  monthLabel: string;
  receita: number;
  despesas: number;
  resultado: number;
  margem: number;
};

export type RelatorioFinanceiroData = {
  receitaTotal: number;
  despesasTotal: number;
  resultadoLiquido: number;
  margem: number;
  mensal: RelatorioMensalRow[];
  chartMensal: { label: string; receitas: number; despesas: number }[];
  porFormaPagamento: { name: string; value: number }[];
  porCategoria: { name: string; value: number }[];
};

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function groupSumByKey<T>(
  rows: T[],
  keyFn: (row: T) => string,
  valueFn: (row: T) => number,
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + valueFn(row));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function aggregateRelatorioFinanceiro(
  receitas: ReceitaRow[],
  despesas: DespesaRow[],
  start: string,
  end: string,
): RelatorioFinanceiroData {
  const monthKeys = monthsInRange(start, end);

  let receitaTotal = 0;
  let despesasTotal = 0;

  const mensal: RelatorioMensalRow[] = monthKeys.map((monthKey) => {
    const receita = receitas
      .filter((r) => monthKeyFromDate(r.data_recebimento) === monthKey)
      .reduce((acc, r) => acc + Number(r.valor), 0);
    const desp = despesas
      .filter((d) => monthKeyFromDate(d.data_pagamento) === monthKey)
      .reduce((acc, d) => acc + Number(d.valor), 0);

    receitaTotal += receita;
    despesasTotal += desp;

    const resultado = receita - desp;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;

    return {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      receita,
      despesas: desp,
      resultado,
      margem,
    };
  });

  const resultadoLiquido = receitaTotal - despesasTotal;
  const margem = receitaTotal > 0 ? (resultadoLiquido / receitaTotal) * 100 : 0;

  return {
    receitaTotal,
    despesasTotal,
    resultadoLiquido,
    margem,
    mensal,
    chartMensal: mensal.map((m) => ({
      label: m.monthLabel,
      receitas: m.receita,
      despesas: m.despesas,
    })),
    porFormaPagamento: groupSumByKey(
      receitas,
      (r) => (r.forma_pagamento?.trim() || "Não informado"),
      (r) => Number(r.valor),
    ),
    porCategoria: groupSumByKey(
      despesas,
      (d) => (d.categoria?.trim() || "Outros"),
      (d) => Number(d.valor),
    ),
  };
}

export function periodSubtitleLabel(preset: string): string {
  const map: Record<string, string> = {
    hoje: "Hoje",
    semana: "Semana",
    mes: "Mês",
    mes_passado: "Último mês",
    "3meses": "3 Meses",
    "6meses": "6 Meses",
    ano: "Ano",
    personalizado: "Personalizado",
  };
  return map[preset] ?? "Período selecionado";
}
