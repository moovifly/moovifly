"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import {
  ChartEmptyState,
  chartGridProps,
  chartXAxisProps,
  chartYAxisProps,
} from "@/components/backoffice/charts/chart-kit";
import { DonutChart } from "@/components/backoffice/charts/donut-chart";

const REVENUE_CATEGORY_LABELS: Record<string, string> = {
  seguro_viagem: "Seguro Viagem",
  passagem: "Passagem",
  pacote: "Pacote",
  hospedagem: "Hospedagem",
  corporativo: "Corporativo",
  "lua-de-mel": "Lua de mel",
  grupo: "Grupo",
  economica: "Econômica",
  executiva: "Executiva",
  outros: "Outros",
};

export function formatRevenueCategoryLabel(key: string): string {
  const normalized = key.trim().toLowerCase();
  return REVENUE_CATEGORY_LABELS[normalized] ?? (key.charAt(0).toUpperCase() + key.slice(1));
}

export type SalesChartPoint = {
  label: string;
  valor: number;
  qtd?: number;
  vendas?: number[];
};

function SalesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: SalesChartPoint }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const total = Number(row.valor ?? 0);
  const vendas = row.vendas ?? [];
  const qtd = row.qtd ?? (row.vendas ? row.vendas.length : undefined);

  return (
    <div className="min-w-[170px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 shadow-[var(--shadow-md)]">
      <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">{label}</p>
      <p className="flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-400)]" aria-hidden />
          Faturamento
        </span>
        <span className="font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
      </p>
      {typeof qtd === "number" && qtd > 1 && vendas.length > 1 ? (
        <>
          <p className="mt-1.5 text-xs text-[var(--accent-400)]">{qtd} vendas neste dia</p>
          <ul className="mt-1 space-y-0.5 border-t border-[var(--border-subtle)] pt-1">
            {vendas.map((v, i) => (
              <li key={i} className="flex justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>Venda {i + 1}</span>
                <span className="font-medium tabular-nums text-foreground">{formatCurrency(v)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : typeof qtd === "number" && qtd === 1 ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">1 venda</p>
      ) : null}
    </div>
  );
}

/** Tendência de vendas do período: área com gradiente, dot apenas no hover. */
export function SalesTrendChart({ data }: { data: SalesChartPoint[] }) {
  const gradientId = useId();
  const hasData = useMemo(() => data.some((d) => d.valor > 0), [data]);

  if (!data.length || !hasData) {
    return (
      <ChartEmptyState
        icon={BarChart3}
        title="Sem vendas no período"
        description="As vendas confirmadas aparecerão aqui assim que forem registradas."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-400)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent-400)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartXAxisProps} />
        <YAxis {...chartYAxisProps} domain={[0, "auto"]} />
        <Tooltip
          content={<SalesTooltip />}
          cursor={{ stroke: "var(--border-strong)", strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="valor"
          name="Faturamento"
          stroke="var(--accent-400)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: "var(--accent-400)", stroke: "var(--bg-card)", strokeWidth: 2 }}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Distribuição de receita por categoria: donut com total no centro e legenda ao lado. */
export function RevenueDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <DonutChart
      data={data}
      formatName={formatRevenueCategoryLabel}
      emptyTitle="Sem receita no período"
      emptyDescription="A distribuição por tipo de venda aparecerá aqui quando houver vendas confirmadas."
    />
  );
}
