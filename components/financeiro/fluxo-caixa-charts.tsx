"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { CashflowRow } from "@/lib/financial/fluxo-caixa";

const tooltipStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  fontSize: 12,
};

export function FluxoSaldoLineChart({ rows }: { rows: CashflowRow[] }) {
  const data = rows.map((r) => ({
    label: r.monthLabel,
    saldo: r.saldoFinal,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          width={56}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(Number(v)).replace(/\s/g, "")}
        />
        <ReferenceLine y={0} stroke="var(--border-subtle)" />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Saldo"]}
          contentStyle={tooltipStyle}
        />
        <Line type="monotone" dataKey="saldo" stroke="var(--accent-600)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FluxoEntradasSaidasBarChart({ rows }: { rows: CashflowRow[] }) {
  const data = rows.map((r) => ({
    label: r.monthLabel,
    entradas: r.entradas,
    saidas: r.saidas,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
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
            name === "entradas" ? "Entradas" : "Saídas",
          ]}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="entradas" fill="#4a7c59" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saidas" fill="#b45309" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
