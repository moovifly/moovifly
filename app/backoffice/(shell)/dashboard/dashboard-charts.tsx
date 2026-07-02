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

/** Tons de verde para segmentos de vendas no mesmo dia (base → topo da barra). */
const STACK_GREENS = ["#1f3d10", "#2d5016", "#3d6b24", "#4a7c59", "#5c9469", "#7fa984", "#9bc4a3"];

export type SalesChartPoint = {
  label: string;
  valor: number;
  qtd?: number;
  vendas?: number[];
};

type ChartRow = SalesChartPoint & Record<string, string | number | number[]>;

function vendasDoPonto(ponto: SalesChartPoint): number[] {
  if (ponto.vendas?.length) return ponto.vendas;
  return ponto.valor > 0 ? [ponto.valor] : [];
}

function topSegmentIndex(row: ChartRow | undefined, maxSegs: number): number {
  if (!row) return 0;
  for (let i = maxSegs - 1; i >= 0; i--) {
    if (Number(row[`seg${i}`] ?? 0) > 0) return i;
  }
  return 0;
}

const BAR_TOP_RADIUS = 4;

function makeStackBarShape(segmentIndex: number, maxSegs: number) {
  return function StackBarShape(props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    payload?: ChartRow;
  }) {
    const { x = 0, y = 0, width = 0, height = 0, fill, payload } = props;
    if (height <= 0 || width <= 0) return null;

    const roundTop = segmentIndex === topSegmentIndex(payload, maxSegs);
    const r = Math.min(BAR_TOP_RADIUS, width / 2, height / 2);

    if (!roundTop || r <= 0) {
      return <rect x={x} y={y} width={width} height={height} fill={fill} />;
    }

    if (height <= r * 2) {
      return <rect x={x} y={y} width={width} height={height} fill={fill} rx={r} ry={r} />;
    }

    const path = [
      `M ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      `H ${x + width - r}`,
      `Q ${x + width} ${y} ${x + width} ${y + r}`,
      `V ${y + height}`,
      `H ${x}`,
      `Z`,
    ].join(" ");

    return <path d={path} fill={fill} />;
  };
}

function SalesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const vendas = vendasDoPonto(row);
  const total = Number(row.valor ?? 0);
  const qtd = Number(row.qtd ?? vendas.length);

  return (
    <div
      className="rounded-lg border border-(--border-subtle) bg-card px-3 py-2 text-xs shadow-sm"
      style={{ minWidth: 160 }}
    >
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <p className="text-foreground">
        <span className="text-muted-foreground">Total: </span>
        {formatCurrency(total)}
      </p>
      {qtd > 1 ? (
        <>
          <p className="mt-1 text-(--accent-700)">{qtd} vendas neste dia</p>
          <ul className="mt-1 space-y-0.5 border-t border-(--border-subtle) pt-1">
            {vendas.map((v, i) => (
              <li key={i} className="flex justify-between gap-3 text-muted-foreground">
                <span>Venda {i + 1}</span>
                <span className="font-medium text-foreground">{formatCurrency(v)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : qtd === 1 ? (
        <p className="mt-0.5 text-muted-foreground">1 venda</p>
      ) : null}
    </div>
  );
}

export function SalesBarChart({ data }: { data: SalesChartPoint[] }) {
  const maxSegs = useMemo(
    () => Math.max(1, ...data.map((d) => vendasDoPonto(d).length)),
    [data],
  );

  const chartRows = useMemo(() => {
    return data.map((d) => {
      const vendas = vendasDoPonto(d);
      const valor = d.valor;
      const totalNorm = reaisParaAlturaBarra(valor);
      const row: ChartRow = {
        ...d,
        qtd: d.qtd ?? vendas.length,
        vendas,
        valorNorm: totalNorm,
      };

      if (vendas.length <= 1) {
        row.seg0 = totalNorm;
      } else {
        vendas.forEach((v, i) => {
          row[`seg${i}`] = totalNorm * (v / valor);
        });
      }

      return row;
    });
  }, [data]);

  const maxValor = data.length ? Math.max(0, ...data.map((d) => d.valor)) : 0;
  const normMax = Math.max(1, reaisParaAlturaBarra(Math.max(100_000, maxValor)));
  const xInterval = Math.max(0, Math.round(data.length / 6) - 1);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={xInterval} />
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
        <Tooltip content={<SalesTooltip />} cursor={{ fill: "var(--bg-hover)", opacity: 0.35 }} />
        {Array.from({ length: maxSegs }, (_, i) => (
          <Bar
            key={i}
            dataKey={`seg${i}`}
            stackId="vendas"
            fill={STACK_GREENS[Math.min(i, STACK_GREENS.length - 1)]}
            shape={makeStackBarShape(i, maxSegs)}
          />
        ))}
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
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="75%"
              paddingAngle={data.length > 1 ? 2 : 0}
              dataKey="value"
              nameKey="name"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                const name = String(item.name ?? item.payload?.name ?? "");
                const value = Number(item.value ?? 0);
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return (
                  <div className="rounded-lg border border-(--border-subtle) bg-card px-3 py-2 text-xs shadow-sm">
                    <p className="font-semibold text-foreground">{formatRevenueCategoryLabel(name)}</p>
                    <p className="text-foreground">{formatCurrency(value)}</p>
                    <p className="text-muted-foreground">{pct}% do total</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-semibold leading-tight text-foreground">{centerLabel}</span>
        </div>
      </div>

      {data.length > 0 && (
        <ul className="flex max-h-16 shrink-0 flex-wrap justify-center gap-x-4 gap-y-1 overflow-y-auto px-1 pb-0.5">
          {data.map((entry, index) => {
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
            return (
              <li key={entry.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  aria-hidden
                />
                <span className="text-muted-foreground">{formatRevenueCategoryLabel(entry.name)}</span>
                <span className="font-medium text-foreground">{formatCurrency(entry.value)}</span>
                <span className="text-muted-foreground">({pct}%)</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
