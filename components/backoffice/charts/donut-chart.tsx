"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import type { PieSectorDataItem } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { ChartEmptyState, seriesColor } from "./chart-kit";

export type DonutDatum = { name: string; value: number };

type DonutSlice = DonutDatum & { displayName: string };

/** Setor ativo expandido no hover. */
function renderActiveSector(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius = 0, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={Number(outerRadius) + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--bg-card)"
      strokeWidth={2}
    />
  );
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: number | string; payload?: { fill?: string } }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = String(item.name ?? "");
  const value = Number(item.value ?? 0);
  const pct = total > 0 ? ((value / total) * 100).toFixed(1).replace(".", ",") : "0";

  return (
    <div className="min-w-[140px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 shadow-[var(--shadow-md)]">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: item.payload?.fill ?? "var(--accent-600)" }}
          aria-hidden
        />
        {name}
      </p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(value)}</p>
      <p className="text-xs text-[var(--text-muted)]">{pct}% do total</p>
    </div>
  );
}

/**
 * Donut padrão: total no centro, setor ativo expandido no hover e
 * legenda ao lado com valores e percentuais. Categorias além de
 * `maxSlices` são agrupadas em "Outros".
 */
export function DonutChart({
  data,
  centerTitle = "Total",
  formatName = (name: string) => name,
  maxSlices = 5,
  emptyTitle = "Sem dados no período",
  emptyDescription,
}: {
  data: DonutDatum[];
  centerTitle?: string;
  formatName?: (name: string) => string;
  maxSlices?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const slices = useMemo<DonutSlice[]>(() => {
    const sorted = data
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((d) => ({ ...d, displayName: formatName(d.name) }));
    if (sorted.length <= maxSlices + 1) return sorted;
    const head = sorted.slice(0, maxSlices);
    const restValue = sorted.slice(maxSlices).reduce((sum, d) => sum + d.value, 0);
    return [...head, { name: "__outros__", value: restValue, displayName: "Outros" }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, maxSlices]);

  if (total <= 0 || slices.length === 0) {
    return <ChartEmptyState icon={PieChartIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <div className="relative h-full min-h-[170px] w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              dataKey="value"
              nameKey="displayName"
              stroke="transparent"
              activeShape={renderActiveSector}
              animationDuration={700}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.name} fill={seriesColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[52%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center">
          <span className="text-xs text-[var(--text-muted)]">{centerTitle}</span>
          <span className="text-sm font-semibold leading-tight text-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <ul className="max-h-24 w-full shrink-0 space-y-1.5 overflow-y-auto pr-1 sm:max-h-full sm:w-[46%]">
        {slices.map((slice, index) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <li key={slice.name} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seriesColor(index) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
                {slice.displayName}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(slice.value)}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-[var(--text-muted)]">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
