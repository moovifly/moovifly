"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";

const DONUT_COLORS = ["#4a7c59", "#2563EB", "#9333EA", "#EA580C", "#0891B2", "#6B7280", "#DC2626", "#CA8A04"];

const tooltipStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  fontSize: 12,
};

export function ReceitasDespesasLineChart({
  data,
}: {
  data: { label: string; receitas: number; despesas: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 2, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          width={56}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(Number(v)).replace(/\s/g, "")}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === "receitas" ? "Receitas" : "Despesas",
          ]}
          contentStyle={tooltipStyle}
        />
        <Legend
          verticalAlign="bottom"
          formatter={(value) => (value === "receitas" ? "Receitas" : "Despesas")}
        />
        <Line
          type="monotone"
          dataKey="receitas"
          stroke="#16A34A"
          strokeWidth={2}
          dot={{ r: 3, fill: "#16A34A" }}
          name="receitas"
        />
        <Line
          type="monotone"
          dataKey="despesas"
          stroke="#DC2626"
          strokeWidth={2}
          dot={{ r: 3, fill: "#DC2626" }}
          name="despesas"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FinanceDonut({
  data,
  emptyLabel = "Sem dados",
}: {
  data: { name: string; value: number }[];
  emptyLabel?: string;
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
        {emptyLabel}
      </div>
    );
  }

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
              <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => [
              formatCurrency(Number(value)),
              String(item?.payload?.name ?? ""),
            ]}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-[var(--text-secondary)]">Total</span>
        <span className="text-sm font-semibold text-foreground">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
