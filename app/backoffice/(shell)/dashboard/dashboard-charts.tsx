"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#2d5016", "#4a7c59", "#7fa984", "#a8cecc", "#b8c5d6", "#d4c4a8"];

/** Eixo Y do relatório de vendas (valores em R$): 0k → 1k → … → 30k → 40k → … → 100k */
const SALES_REPORT_Y_TICKS_REAIS = [
  0,
  1_000,
  5_000,
  10_000,
  15_000,
  20_000,
  25_000,
  30_000,
  40_000,
  50_000,
  60_000,
  70_000,
  80_000,
  90_000,
  100_000,
] as const;

function formatSalesYTick(reais: number): string {
  return `R$${reais / 1000}k`;
}

const SALES_Y_TICK_COUNT = SALES_REPORT_Y_TICKS_REAIS.length;
const SALES_Y_SEG = SALES_Y_TICK_COUNT - 1;

/** Coloca cada marca do eixo Y à mesma distância visual; evita amontoar 0k–30k num eixo linear. */
function reaisParaAlturaBarra(reais: number): number {
  const T = SALES_REPORT_Y_TICKS_REAIS;
  const top = T[SALES_Y_TICK_COUNT - 1];
  const penultimo = T[SALES_Y_TICK_COUNT - 2];
  if (!Number.isFinite(reais) || reais <= 0) return 0;
  if (reais >= top) {
    const run = top - penultimo;
    const step = 1 / SALES_Y_SEG;
    if (run <= 0) return 1;
    return 1 + ((reais - top) / run) * step;
  }
  for (let i = 0; i < SALES_Y_SEG; i++) {
    if (reais <= T[i + 1]) {
      const run = T[i + 1] - T[i];
      const t = run > 0 ? (reais - T[i]) / run : 0;
      return (i + t) / SALES_Y_SEG;
    }
  }
  return 1;
}

const SALES_Y_NORM_TICKS = Array.from({ length: SALES_Y_TICK_COUNT }, (_, i) => i / SALES_Y_SEG);

export function SalesBarChart({ data }: { data: { label: string; valor: number }[] }) {
  const chartRows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        valorNorm: reaisParaAlturaBarra(d.valor),
      })),
    [data],
  );

  const maxValor = data.length ? Math.max(0, ...data.map((d) => d.valor)) : 0;
  const normMax = Math.max(1, reaisParaAlturaBarra(Math.max(100_000, maxValor)));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          width={44}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={[0, normMax]}
          ticks={SALES_Y_NORM_TICKS}
          interval={0}
          tickFormatter={(y) => {
            const i = Math.min(SALES_Y_SEG, Math.max(0, Math.round(Number(y) * SALES_Y_SEG)));
            return formatSalesYTick(SALES_REPORT_Y_TICKS_REAIS[i]);
          }}
        />
        <Tooltip
          formatter={(_value, _name, item) => [
            formatCurrency(Number(item?.payload?.valor ?? 0)),
            "Vendas",
          ]}
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="valorNorm" fill="var(--accent-600)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueDonut({
  data,
  centerLabel,
}: {
  data: { name: string; value: number }[];
  centerLabel: string;
}) {
  return (
    <div className="relative flex h-full items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="75%"
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), "Total"]}
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-[var(--text-secondary)]">Total</span>
        <span className="text-sm font-semibold text-foreground">{centerLabel}</span>
      </div>
    </div>
  );
}
