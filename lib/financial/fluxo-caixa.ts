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

function sumByMonth(movements: FluxoMovement[], monthKey: string): number {
  return movements
    .filter((m) => monthKeyFromDate(m.date) === monthKey)
    .reduce((acc, m) => acc + m.amount, 0);
}

export function aggregateCashflow(
  entradas: FluxoMovement[],
  saidas: FluxoMovement[],
  start: string,
  end: string,
  saldoInicialConta = 0,
): FluxoCaixaResult {
  const monthKeys = monthsInRange(start, end);
  let saldoAcum = saldoInicialConta;
  let totalEntradas = 0;
  let totalSaidas = 0;

  const rows: CashflowRow[] = monthKeys.map((monthKey) => {
    const entradasMes = sumByMonth(entradas, monthKey);
    const saidasMes = sumByMonth(saidas, monthKey);
    const saldoInicial = saldoAcum;
    const saldoFinal = saldoInicial + entradasMes - saidasMes;

    totalEntradas += entradasMes;
    totalSaidas += saidasMes;
    saldoAcum = saldoFinal;

    return {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      saldoInicial,
      entradas: entradasMes,
      saidas: saidasMes,
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
  }[],
  entradas: FluxoMovement[],
  saidas: FluxoMovement[],
  start: string,
  end: string,
): ContaBancariaResumo[] {
  return contas.map((conta) => {
    const entradasConta = entradas.filter((e) => e.conta_bancaria_id === conta.id);
    const saidasConta = saidas.filter((s) => s.conta_bancaria_id === conta.id);
    const result = aggregateCashflow(entradasConta, saidasConta, start, end, Number(conta.saldo_inicial));

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
