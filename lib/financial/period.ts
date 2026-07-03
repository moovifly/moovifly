export type FinancePeriodPreset =
  | "hoje"
  | "semana"
  | "mes"
  | "mes_passado"
  | "3meses"
  | "6meses"
  | "ano";

export type FinancePeriod = {
  preset: FinancePeriodPreset | "personalizado" | "";
  start: string;
  end: string;
};

export function localDateISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const FINANCE_PERIOD_PRESETS: {
  key: FinancePeriodPreset;
  label: string;
  range: () => { from: string; to: string };
}[] = [
  {
    key: "hoje",
    label: "Hoje",
      range: () => {
        const t = localDateISO();
        return { from: t, to: t };
      },
  },
  {
    key: "semana",
    label: "Esta semana",
      range: () => {
        const d = new Date();
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return { from: localDateISO(mon), to: localDateISO(d) };
      },
  },
  {
    key: "mes",
    label: "Este mês",
      range: () => {
        const d = new Date();
        return {
          from: localDateISO(new Date(d.getFullYear(), d.getMonth(), 1)),
          to: localDateISO(d),
        };
      },
  },
  {
    key: "mes_passado",
    label: "Último mês",
      range: () => {
        const d = new Date();
        return {
          from: localDateISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
          to: localDateISO(new Date(d.getFullYear(), d.getMonth(), 0)),
        };
      },
  },
  {
    key: "3meses",
    label: "Últ. 3 meses",
      range: () => {
        const d = new Date();
        const from = new Date(d);
        from.setMonth(d.getMonth() - 3);
        return { from: localDateISO(from), to: localDateISO(d) };
      },
  },
  {
    key: "6meses",
    label: "Últ. 6 meses",
      range: () => {
        const d = new Date();
        const from = new Date(d);
        from.setMonth(d.getMonth() - 6);
        return { from: localDateISO(from), to: localDateISO(d) };
      },
  },
  {
    key: "ano",
    label: "Este ano",
      range: () => {
        const d = new Date();
        return {
          from: localDateISO(new Date(d.getFullYear(), 0, 1)),
          to: localDateISO(d),
        };
      },
  },
];

export function defaultFinancePeriod(): FinancePeriod {
  const preset = FINANCE_PERIOD_PRESETS.find((p) => p.key === "mes")!;
  const { from, to } = preset.range();
  return { preset: "mes", start: from, end: to };
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}
