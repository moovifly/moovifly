"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wallet } from "lucide-react";

import {
  ChartEmptyState,
  ChartLegendToggle,
  ChartTooltip,
  chartGridProps,
  chartXAxisProps,
  chartYAxisProps,
} from "./chart-kit";

export type FinanceComposedPoint = {
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
};

/**
 * Gráfico financeiro padrão: barras de entradas (verde) e saídas (vermelho)
 * + linha de saldo acumulado, com legenda clicável e ReferenceLine em zero.
 */
export function FinanceComposedChart({
  data,
  entradasLabel = "Entradas",
  saidasLabel = "Saídas",
  saldoLabel = "Saldo acumulado",
  emptyTitle = "Sem movimentação no período",
  emptyDescription,
}: {
  data: FinanceComposedPoint[];
  entradasLabel?: string;
  saidasLabel?: string;
  saldoLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const hasData = data.some((d) => d.entradas !== 0 || d.saidas !== 0 || d.saldo !== 0);
  if (!data.length || !hasData) {
    return <ChartEmptyState icon={Wallet} title={emptyTitle} description={emptyDescription} />;
  }

  const toggle = (key: string) => setHidden((prev) => ({ ...prev, [key]: !prev[key] }));

  const legendItems = [
    { key: "entradas", label: entradasLabel, color: "var(--success-text)" },
    { key: "saidas", label: saidasLabel, color: "var(--danger-text)" },
    { key: "saldo", label: saldoLabel, color: "var(--purple-500)" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartXAxisProps} />
            <YAxis {...chartYAxisProps} domain={[(dataMin: number) => Math.min(0, dataMin), "auto"]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--bg-hover)" }} />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <Bar
              dataKey="entradas"
              name={entradasLabel}
              fill="var(--success-text)"
              fillOpacity={0.9}
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
              hide={!!hidden.entradas}
              activeBar={{ fillOpacity: 1 }}
              animationDuration={700}
            />
            <Bar
              dataKey="saidas"
              name={saidasLabel}
              fill="var(--danger-text)"
              fillOpacity={0.7}
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
              hide={!!hidden.saidas}
              activeBar={{ fillOpacity: 0.9 }}
              animationDuration={700}
            />
            <Line
              type="monotone"
              dataKey="saldo"
              name={saldoLabel}
              stroke="var(--purple-500)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--purple-500)", stroke: "var(--bg-card)", strokeWidth: 2 }}
              hide={!!hidden.saldo}
              animationDuration={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegendToggle items={legendItems} hidden={hidden} onToggle={toggle} />
    </div>
  );
}
