"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";

import { formatCurrency } from "@/lib/format";

/**
 * Paleta ordenada para séries categóricas.
 * A ordem é fixa: a 1ª categoria sempre recebe a 1ª cor, e assim por diante.
 * Tokens CSS garantem que light/dark funcionem automaticamente.
 */
export const CHART_SERIES_COLORS = [
  "var(--accent-600)",
  "var(--teal-500)",
  "var(--purple-500)",
  "var(--accent-gold)",
  "var(--accent-300)",
  "var(--accent-400)",
  "var(--purple-300)",
  "var(--teal-400)",
] as const;

export function seriesColor(index: number): string {
  return CHART_SERIES_COLORS[Math.min(index, CHART_SERIES_COLORS.length - 1)];
}

const compactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formata valores de eixo de forma compacta (ex.: R$ 2,5 mil). */
export function formatCompactBRL(value: number): string {
  if (!Number.isFinite(value)) return "R$ 0";
  return compactBRL.format(value);
}

/** Grid padrão: apenas linhas horizontais, bem discretas. */
export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--border-dim)",
  vertical: false,
} as const;

const axisTick = { fontSize: 11, fill: "var(--text-muted)" };

/** Eixo X padrão (categorias/dias/meses). */
export const chartXAxisProps = {
  tick: axisTick,
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
  interval: "preserveStartEnd" as const,
  minTickGap: 24,
};

/** Eixo Y padrão para valores monetários. */
export const chartYAxisProps = {
  tick: axisTick,
  axisLine: false,
  tickLine: false,
  width: 58,
  tickFormatter: (value: number) => formatCompactBRL(Number(value)),
};

export type ChartTooltipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

/**
 * Tooltip padrão dos gráficos: card com tokens do tema,
 * label em 12px e valores em BRL com bullet colorido por série.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  nameFormatter,
  valueFormatter = (value: number) => formatCurrency(value),
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  nameFormatter?: (name: string) => string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const heading = label !== undefined && label !== null && label !== "" ? String(label) : null;

  return (
    <div className="min-w-[150px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 shadow-[var(--shadow-md)]">
      {heading && (
        <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
          {labelFormatter ? labelFormatter(heading) : heading}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, index) => {
          const name = String(entry.name ?? entry.dataKey ?? "");
          return (
            <li key={`${name}-${index}`} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-secondary)]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color ?? "var(--accent-600)" }}
                  aria-hidden
                />
                <span className="truncate">{nameFormatter ? nameFormatter(name) : name}</span>
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {valueFormatter(Number(entry.value ?? 0))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Estado vazio de gráfico: ícone + mensagem centralizada (nunca eixos soltos). */
export function ChartEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-overlay)] text-[var(--text-muted)]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {description && <p className="max-w-[280px] text-xs text-[var(--text-muted)]">{description}</p>}
    </div>
  );
}

export type ChartLegendItem = { key: string; label: string; color: string };

/** Legenda clicável para alternar séries (usar quando houver 2+ séries). */
export function ChartLegendToggle({
  items,
  hidden,
  onToggle,
}: {
  items: ChartLegendItem[];
  hidden: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
      {items.map((item) => {
        const isHidden = !!hidden[item.key];
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={!isHidden}
            title={isHidden ? `Mostrar ${item.label}` : `Ocultar ${item.label}`}
            onClick={() => onToggle(item.key)}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-all hover:bg-[var(--bg-hover)] ${
              isHidden ? "opacity-40" : ""
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className={`text-[var(--text-secondary)] ${isHidden ? "line-through" : ""}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sparkline discreto em SVG puro (para KPI cards; sem eixos nem tooltip). */
export function Sparkline({
  data,
  color = "var(--accent-400)",
  className = "h-8 w-full",
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  const gradientId = useId();
  if (data.length < 2) return null;

  const W = 100;
  const H = 28;
  const PAD = 2;
  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const stepX = W / (data.length - 1);
  const points = data.map((value, index) => {
    const x = index * stepX;
    const y = PAD + (H - PAD * 2) * (1 - (value - min) / span);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Barras horizontais comparativas (resumo compacto, sem Recharts). */
export function ComparativeBars({
  items,
  valueFormatter = (value: number) => formatCurrency(value),
}: {
  items: { label: string; value: number; color: string; hint?: string | null }[];
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0) : 0;
        return (
          <li key={item.label} className="flex items-center gap-2 sm:gap-3">
            <div className="w-24 min-w-0 shrink-0 sm:w-44">
              <p className="truncate text-xs font-medium text-[var(--text-secondary)]">{item.label}</p>
              {item.hint && <p className="truncate text-[11px] text-[var(--text-muted)]">{item.hint}</p>}
            </div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
            </div>
            <p className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground sm:w-28">
              {valueFormatter(item.value)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Gráfico de barras simples (uma série monetária) com o estilo padrão. */
export function SimpleBarChart({
  data,
  name,
  color = "var(--accent-500)",
  labelFormatter,
}: {
  data: { label: string; value: number }[];
  name: string;
  color?: string;
  labelFormatter?: (label: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartXAxisProps} />
        <YAxis {...chartYAxisProps} />
        <Tooltip
          content={<ChartTooltip labelFormatter={labelFormatter} />}
          cursor={{ fill: "var(--bg-hover)" }}
        />
        <Bar
          dataKey="value"
          name={name}
          fill={color}
          fillOpacity={0.9}
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          activeBar={{ fillOpacity: 1 }}
          animationDuration={700}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
