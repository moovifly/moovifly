const MONTH_LABELS: Record<string, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

export type FluxoMovement = {
  amount: number;
  date: string;
  conta_bancaria_id: string | null;
};

export type CashflowRow = {
  monthKey: string;
  monthLabel: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
};

export type ContaBancariaResumo = {
  id: string;
  nome: string;
  banco: string | null;
  cor: string;
  saldo_inicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoAtual: number;
  rows: CashflowRow[];
};

export type FluxoCaixaResult = {
  rows: CashflowRow[];
  totalEntradas: number;
  totalSaidas: number;
  saldoAtual: number;
};

export function daysBetweenInclusive(start: string, end: string): number {
  const from = new Date(`${start}T12:00:00`);
  const to = new Date(`${end}T12:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export function daysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  while (cursor <= endDate && days.length < 366) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function dayLabelFromKey(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function monthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  const cursor = new Date(start.slice(0, 7) + "-01");
  const endDate = new Date(end.slice(0, 7) + "-01");

  while (cursor <= endDate) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export function monthLabelFromKey(monthKey: string): string {
  const mm = monthKey.slice(5, 7);
  return MONTH_LABELS[mm] ?? monthKey;
}

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function sumByPeriod(
  movements: FluxoMovement[],
  periodKey: string,
  granularity: "day" | "month",
): number {
  return movements
    .filter((m) => (granularity === "day" ? m.date === periodKey : monthKeyFromDate(m.date) === periodKey))
    .reduce((acc, m) => acc + m.amount, 0);
}

function filterMovementsInRange(movements: FluxoMovement[], start: string, end: string): FluxoMovement[] {
  return movements.filter((m) => m.date >= start && m.date <= end);
}

/** Lançamentos na data ou antes do snapshot já estão embutidos em saldo_inicial. */
export function filterMovementsAfterSnapshot(
  movements: FluxoMovement[],
  dataSaldoInicial: string,
): FluxoMovement[] {
  return movements.filter((m) => m.date > dataSaldoInicial);
}

export function aggregateCashflow(
  entradas: FluxoMovement[],
  saidas: FluxoMovement[],
  start: string,
  end: string,
  saldoInicialConta = 0,
  dataSaldoInicial?: string,
): FluxoCaixaResult {
  const entradasBase = dataSaldoInicial ? filterMovementsAfterSnapshot(entradas, dataSaldoInicial) : entradas;
  const saidasBase = dataSaldoInicial ? filterMovementsAfterSnapshot(saidas, dataSaldoInicial) : saidas;
  const entradasNoPeriodo = filterMovementsInRange(entradasBase, start, end);
  const saidasNoPeriodo = filterMovementsInRange(saidasBase, start, end);
  const byDay = daysBetweenInclusive(start, end) <= 45;
  const periodKeys = byDay ? daysInRange(start, end) : monthsInRange(start, end);
  const granularity = byDay ? "day" : "month";

  let saldoAcum = saldoInicialConta;
  let totalEntradas = 0;
  let totalSaidas = 0;

  const rows: CashflowRow[] = periodKeys.map((periodKey) => {
    const entradasPeriodo = sumByPeriod(entradasNoPeriodo, periodKey, granularity);
    const saidasPeriodo = sumByPeriod(saidasNoPeriodo, periodKey, granularity);
    const saldoInicial = saldoAcum;
    const saldoFinal = saldoInicial + entradasPeriodo - saidasPeriodo;

    totalEntradas += entradasPeriodo;
    totalSaidas += saidasPeriodo;
    saldoAcum = saldoFinal;

    return {
      monthKey: periodKey,
      monthLabel: byDay ? dayLabelFromKey(periodKey) : monthLabelFromKey(periodKey),
      saldoInicial,
      entradas: entradasPeriodo,
      saidas: saidasPeriodo,
      saldoFinal,
    };
  });

  return {
    rows,
    totalEntradas,
    totalSaidas,
    saldoAtual: saldoAcum,
  };
}

export function buildFluxoPorConta(
  contas: {
    id: string;
    nome: string;
    banco: string | null;
    cor: string;
    saldo_inicial: number;
    data_saldo_inicial: string;
    principal?: boolean;
  }[],
  entradas: FluxoMovement[],
  saidas: FluxoMovement[],
  start: string,
  end: string,
): ContaBancariaResumo[] {
  const principalContaId = contas.find((c) => c.principal)?.id ?? contas[0]?.id ?? null;
  const resolveContaId = (contaId: string | null) => contaId ?? principalContaId;

  return contas.map((conta) => {
    const entradasConta = entradas.filter((e) => resolveContaId(e.conta_bancaria_id) === conta.id);
    const saidasConta = saidas.filter((s) => resolveContaId(s.conta_bancaria_id) === conta.id);
    const result = aggregateCashflow(
      entradasConta,
      saidasConta,
      start,
      end,
      Number(conta.saldo_inicial),
      conta.data_saldo_inicial,
    );

    return {
      id: conta.id,
      nome: conta.nome,
      banco: conta.banco,
      cor: conta.cor,
      saldo_inicial: Number(conta.saldo_inicial),
      totalEntradas: result.totalEntradas,
      totalSaidas: result.totalSaidas,
      saldoAtual: result.saldoAtual,
      rows: result.rows,
    };
  });
}

type FluxoRawRow = {
  valor: number | string;
  data_recebimento?: string | null;
  data_pagamento?: string | null;
  conta_bancaria_id?: string | null;
};

export type FluxoCaixaPayload = {
  consolidado: FluxoCaixaResult;
  contas: {
    id: string;
    nome: string;
    banco: string | null;
    cor: string;
    saldo_inicial: number;
    data_saldo_inicial: string;
    principal: boolean;
  }[];
  contasResumo: ContaBancariaResumo[];
};

export async function fetchFluxoCaixaData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  start: string,
  end: string,
): Promise<FluxoCaixaPayload> {
  const [recebidasRes, pagasRes, contasRes] = await Promise.all([
    supabase
      .from("contas_receber")
      .select("valor, data_recebimento, conta_bancaria_id")
      .eq("status", "recebida")
      .not("data_recebimento", "is", null)
      .gte("data_recebimento", start)
      .lte("data_recebimento", end),
    supabase
      .from("contas_pagar")
      .select("valor, data_pagamento, conta_bancaria_id")
      .eq("status", "paga")
      .not("data_pagamento", "is", null)
      .gte("data_pagamento", start)
      .lte("data_pagamento", end),
    supabase
      .from("contas_bancarias")
      .select("id, nome, banco, cor, saldo_inicial, data_saldo_inicial, principal")
      .eq("ativa", true)
      .order("nome"),
  ]);

  if (recebidasRes.error) throw new Error(recebidasRes.error.message);
  if (pagasRes.error) throw new Error(pagasRes.error.message);
  if (contasRes.error) throw new Error(contasRes.error.message);

  const entradas = ((recebidasRes.data ?? []) as FluxoRawRow[])
    .map((r) => toFluxoMovement(r.valor, r.data_recebimento, r.conta_bancaria_id))
    .filter((m): m is FluxoMovement => m !== null);

  const saidas = ((pagasRes.data ?? []) as FluxoRawRow[])
    .map((p) => toFluxoMovement(p.valor, p.data_pagamento, p.conta_bancaria_id))
    .filter((m): m is FluxoMovement => m !== null);

  const contasAtivas = (contasRes.data ?? []) as FluxoCaixaPayload["contas"];

  return {
    consolidado: aggregateCashflow(entradas, saidas, start, end),
    contas: contasAtivas,
    contasResumo: buildFluxoPorConta(contasAtivas, entradas, saidas, start, end),
  };
}

export function toFluxoMovement(
  amount: number | string | null | undefined,
  date: string | null | undefined,
  conta_bancaria_id: string | null | undefined,
): FluxoMovement | null {
  if (!date) return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { amount: num, date: date.slice(0, 10), conta_bancaria_id: conta_bancaria_id ?? null };
}
