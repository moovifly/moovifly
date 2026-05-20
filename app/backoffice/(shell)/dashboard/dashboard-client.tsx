"use client";

import { BackofficeLink } from "@/components/backoffice/backoffice-link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  X,
  Loader2,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { UserProfile } from "@/lib/auth";
import { SalesBarChart, RevenueDonut } from "./dashboard-charts";
import {
  EMBARQUE_ALERT_OFFSETS,
  calendarDaysFromToday,
  embarqueAlertTitle,
  parseDateOnlyToLocal,
  startOfLocalDay,
  toLocalDateOnlyString,
  type EmbarqueAlertOffsetDays,
} from "@/lib/embarques";

type RecentSale = {
  id: string;
  numero_venda: string;
  destino: string | null;
  valor_total: number | string;
  status: string;
  clientes?: { nome: string } | { nome: string }[] | null;
};

function relName(rel: RecentSale["clientes"]): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.nome;
  return rel.nome;
}

type TopSeller = { nome: string; total: number; vendas: number };
type Stats = {
  totalClientes: number;
  totalVendas: number;
  faturamentoTotal: number;
  trendClientes: number | null;
  trendVendas: number | null;
  trendFaturamento: number | null;
};
type Financial = {
  contasReceberValor: number;
  contasReceberCount: number;
  contasPagarValor: number | null;
  contasPagarCount: number | null;
  comissaoPendenteValor: number | null;
  comissaoPendenteCount: number | null;
};

type EmbarqueAlert = {
  venda_id: string;
  numero_venda: string;
  destino: string | null;
  data_ida: string;
  cliente_nome: string | null;
  diffDays: EmbarqueAlertOffsetDays;
};

const initialStats: Stats = {
  totalClientes: 0,
  totalVendas: 0,
  faturamentoTotal: 0,
  trendClientes: null,
  trendVendas: null,
  trendFaturamento: null,
};
const initialFinancial: Financial = {
  contasReceberValor: 0,
  contasReceberCount: 0,
  contasPagarValor: null,
  contasPagarCount: null,
  comissaoPendenteValor: null,
  comissaoPendenteCount: null,
};

function relClienteNome(rel: { nome: string } | { nome: string }[] | null | undefined) {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.nome ?? null;
  return rel.nome ?? null;
}

async function loadEmbarqueAlerts(profile: UserProfile): Promise<EmbarqueAlert[]> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const today = startOfLocalDay(now);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  let q = supabase
    .from("vendas")
    .select("id, numero_venda, destino, data_ida, clientes(nome), vendedor_id, status")
    .in("status", ["confirmada", "concluida"])
    .not("data_ida", "is", null)
    .gte("data_ida", toLocalDateOnlyString(today))
    .lte("data_ida", toLocalDateOnlyString(end))
    .order("data_ida", { ascending: true });

  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }

  const { data, error } = await q;
  if (error) throw error;

  const list = (data ?? []) as unknown as Array<{
    id: string;
    numero_venda: string;
    destino: string | null;
    data_ida: string | null;
    clientes?: { nome: string } | { nome: string }[] | null;
  }>;

  const alerts: EmbarqueAlert[] = [];
  for (const v of list) {
    if (!v.data_ida) continue;
    const diff = calendarDaysFromToday(v.data_ida, now);
    if (!EMBARQUE_ALERT_OFFSETS.includes(diff as EmbarqueAlertOffsetDays)) continue;
    alerts.push({
      venda_id: v.id,
      numero_venda: v.numero_venda,
      destino: v.destino,
      data_ida: v.data_ida,
      cliente_nome: relClienteNome(v.clientes),
      diffDays: diff as EmbarqueAlertOffsetDays,
    });
  }

  // Prioriza mais urgente (0, 3, 5, 7) e mais próximo
  const priority = new Map<number, number>([
    [0, 0],
    [3, 1],
    [5, 2],
    [7, 3],
  ]);
  return alerts.sort((a, b) => {
    const pa = priority.get(a.diffDays) ?? 9;
    const pb = priority.get(b.diffDays) ?? 9;
    if (pa !== pb) return pa - pb;
    return a.data_ida.localeCompare(b.data_ida);
  });
}

function dismissKey(a: EmbarqueAlert) {
  return `mf:embarque_alert:dismissed:${a.venda_id}:${a.diffDays}`;
}

type Period = "hoje" | "semana" | "mes" | "mes_passado" | "3meses" | "6meses" | "ano";

type DateRange = {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  trendLabel: string;
  groupBy: "hour" | "day" | "month";
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "mes_passado", label: "Último mês" },
  { value: "3meses", label: "Últ. 3 meses" },
  { value: "6meses", label: "Últ. 6 meses" },
  { value: "ano", label: "Este ano" },
];

function getDateRange(period: Period): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let end: Date = now;
  let prevStart: Date;
  let prevEnd: Date;
  let trendLabel: string;
  let groupBy: "hour" | "day" | "month" = "day";

  switch (period) {
    case "hoje":
      start = today;
      prevEnd = today;
      prevStart = new Date(today); prevStart.setDate(prevStart.getDate() - 1);
      trendLabel = "vs ontem";
      groupBy = "hour";
      break;
    case "semana": {
      const dow = today.getDay();
      const daysBack = dow === 0 ? 6 : dow - 1;
      start = new Date(today); start.setDate(start.getDate() - daysBack);
      prevEnd = new Date(start);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
      trendLabel = "vs semana anterior";
      break;
    }
    case "mes":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      trendLabel = "vs mês anterior";
      break;
    case "mes_passado":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      trendLabel = "vs mês anterior";
      break;
    case "3meses":
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      trendLabel = "vs 3 meses anteriores";
      groupBy = "month";
      break;
    case "6meses":
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      trendLabel = "vs 6 meses anteriores";
      groupBy = "month";
      break;
    case "ano":
      start = new Date(now.getFullYear(), 0, 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      trendLabel = "vs ano anterior";
      groupBy = "month";
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      trendLabel = "vs mês anterior";
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart!.toISOString(),
    prevEnd: prevEnd!.toISOString(),
    trendLabel,
    groupBy,
  };
}

function calcTrend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

async function loadStats(profile: UserProfile, range: DateRange): Promise<Stats> {
  const supabase = getSupabaseClient();
  const isAdmin = ["administrador", "gerente"].includes(profile.tipo);

  let totalClientesQ = supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo");
  if (!isAdmin) totalClientesQ = totalClientesQ.eq("vendedor_id", profile.id);

  let clientesThisQ = supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo").gte("created_at", range.start).lte("created_at", range.end);
  if (!isAdmin) clientesThisQ = clientesThisQ.eq("vendedor_id", profile.id);

  let clientesPrevQ = supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo").gte("created_at", range.prevStart).lt("created_at", range.prevEnd);
  if (!isAdmin) clientesPrevQ = clientesPrevQ.eq("vendedor_id", profile.id);

  let vendasThisQ = supabase.from("vendas").select("id, valor_total", { count: "exact" }).gte("created_at", range.start).lte("created_at", range.end).in("status", ["confirmada", "concluida"]);
  if (!isAdmin) vendasThisQ = vendasThisQ.eq("vendedor_id", profile.id);

  let vendasPrevQ = supabase.from("vendas").select("id, valor_total", { count: "exact" }).gte("created_at", range.prevStart).lt("created_at", range.prevEnd).in("status", ["confirmada", "concluida"]);
  if (!isAdmin) vendasPrevQ = vendasPrevQ.eq("vendedor_id", profile.id);

  const [
    { count: totalClientes },
    { count: clientesThis },
    { count: clientesPrev },
    { data: vendas, count: totalVendas },
    { data: vendasPrev, count: totalVendasPrev },
  ] = await Promise.all([totalClientesQ, clientesThisQ, clientesPrevQ, vendasThisQ, vendasPrevQ]);

  const faturamentoTotal = vendas?.reduce((sum: number, v: { valor_total?: number | string | null }) => sum + Number.parseFloat(String(v.valor_total ?? 0)), 0) ?? 0;
  const faturamentoPrev = vendasPrev?.reduce((sum: number, v: { valor_total?: number | string | null }) => sum + Number.parseFloat(String(v.valor_total ?? 0)), 0) ?? 0;

  return {
    totalClientes: totalClientes ?? 0,
    totalVendas: totalVendas ?? 0,
    faturamentoTotal,
    trendClientes: calcTrend(clientesThis ?? 0, clientesPrev ?? 0),
    trendVendas: calcTrend(totalVendas ?? 0, totalVendasPrev ?? 0),
    trendFaturamento: calcTrend(faturamentoTotal, faturamentoPrev),
  };
}

async function loadRecentSales(profile: UserProfile, range: DateRange): Promise<RecentSale[]> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from("vendas")
    .select("id, numero_venda, destino, valor_total, status, clientes (nome)")
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .order("created_at", { ascending: false })
    .limit(5);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RecentSale[];
}

async function loadTopSellers(profile: UserProfile, range: DateRange): Promise<TopSeller[]> {
  if (!["administrador", "gerente"].includes(profile.tipo)) return [];
  const supabase = getSupabaseClient();
  const { data: vendas, error } = await supabase
    .from("vendas")
    .select("vendedor_id, valor_total, usuarios (nome)")
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .in("status", ["confirmada", "concluida"]);
  if (error) throw error;
  type RawSale = {
    vendedor_id: string;
    valor_total: number | string | null;
    usuarios?: { nome?: string } | { nome?: string }[] | null;
  };
  const map = new Map<string, TopSeller>();
  for (const v of (vendas ?? []) as unknown as RawSale[]) {
    const usuariosRel = Array.isArray(v.usuarios) ? v.usuarios[0] : v.usuarios;
    const cur = map.get(v.vendedor_id) ?? {
      nome: usuariosRel?.nome ?? "Desconhecido",
      total: 0,
      vendas: 0,
    };
    cur.total += Number.parseFloat(String(v.valor_total ?? 0));
    cur.vendas += 1;
    map.set(v.vendedor_id, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
}

async function loadFinancial(profile: UserProfile): Promise<Financial> {
  const supabase = getSupabaseClient();
  const { data: contasReceber } = await supabase
    .from("contas_receber")
    .select("valor")
    .eq("status", "pendente");
  const totalReceber =
    contasReceber?.reduce((sum: number, c: { valor?: number | string | null }) => sum + Number.parseFloat(String(c.valor ?? 0)), 0) ?? 0;

  let totalPagar: number | null = null;
  let countPagar: number | null = null;
  if (["administrador", "gerente"].includes(profile.tipo)) {
    const { data: contasPagar } = await supabase
      .from("contas_pagar")
      .select("valor")
      .eq("status", "pendente");
    totalPagar =
      contasPagar?.reduce((sum: number, c: { valor?: number | string | null }) => sum + Number.parseFloat(String(c.valor ?? 0)), 0) ?? 0;
    countPagar = contasPagar?.length ?? 0;
  }

  let comissaoPendenteValor: number | null = null;
  let comissaoPendenteCount: number | null = null;
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    const { data: comissoes } = await supabase
      .from("comissoes")
      .select("valor")
      .eq("vendedor_id", profile.id)
      .eq("status", "pendente");
    comissaoPendenteValor =
      comissoes?.reduce((sum: number, c: { valor?: number | string | null }) => sum + Number.parseFloat(String(c.valor ?? 0)), 0) ?? 0;
    comissaoPendenteCount = comissoes?.length ?? 0;
  }

  return {
    contasReceberValor: totalReceber,
    contasReceberCount: contasReceber?.length ?? 0,
    contasPagarValor: totalPagar,
    contasPagarCount: countPagar,
    comissaoPendenteValor,
    comissaoPendenteCount,
  };
}

async function loadSalesByDay(profile: UserProfile, range: DateRange) {
  const supabase = getSupabaseClient();
  let q = supabase
    .from("vendas")
    .select("valor_total, created_at, status")
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .in("status", ["confirmada", "concluida"]);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }
  const { data } = await q;
  const sales = (data ?? []) as Array<{ valor_total: number | string; created_at: string }>;

  if (range.groupBy === "hour") {
    const buckets = new Map<number, number>();
    for (let h = 0; h < 24; h++) buckets.set(h, 0);
    for (const v of sales) {
      const h = new Date(v.created_at).getHours();
      buckets.set(h, (buckets.get(h) ?? 0) + Number.parseFloat(String(v.valor_total ?? 0)));
    }
    return [...buckets.entries()].map(([hour, value]) => ({
      label: `${String(hour).padStart(2, "0")}h`,
      valor: value,
    }));
  }

  if (range.groupBy === "month") {
    const rStart = new Date(range.start);
    const rEnd = new Date(range.end);
    const buckets = new Map<string, number>();
    const curr = new Date(rStart.getFullYear(), rStart.getMonth(), 1);
    while (curr <= rEnd) {
      buckets.set(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`, 0);
      curr.setMonth(curr.getMonth() + 1);
    }
    for (const v of sales) {
      const d = new Date(v.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number.parseFloat(String(v.valor_total ?? 0)));
    }
    return [...buckets.entries()].map(([key, value]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);
      return { label: d.toLocaleDateString("pt-BR", { month: "short" }), valor: value };
    });
  }

  // Daily grouping
  const rStart = new Date(range.start);
  const rEnd = new Date(range.end);
  const diffDays = Math.min(Math.ceil((rEnd.getTime() - rStart.getTime()) / (24 * 60 * 60 * 1000)) + 1, 31);
  const buckets = new Map<string, number>();
  for (let i = 0; i < diffDays; i++) {
    const d = new Date(rStart); d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const v of sales) {
    const key = new Date(v.created_at).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number.parseFloat(String(v.valor_total ?? 0)));
  }
  const isShortPeriod = diffDays <= 7;
  return [...buckets.entries()].map(([date, value]) => ({
    label: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", isShortPeriod ? { weekday: "short" } : { day: "2-digit", month: "2-digit" }),
    valor: value,
  }));
}

async function loadRevenueByCategory(profile: UserProfile, range: DateRange) {
  const supabase = getSupabaseClient();
  /* tipo = categoria comercial; classe = econômica/executiva… fallback para dados antigos sem tipo */
  let q = supabase
    .from("vendas")
    .select("tipo, classe, valor_total, status")
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .in("status", ["confirmada", "concluida"]);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }
  const { data } = await q;
  const grupos = new Map<string, number>();
  for (const v of (data ?? []) as Array<{
    tipo: string | null;
    classe: string | null;
    valor_total: number | string | null;
  }>) {
    const key = v.tipo?.trim() || v.classe?.trim() || "Outros";
    grupos.set(key, (grupos.get(key) ?? 0) + Number.parseFloat(String(v.valor_total ?? 0)));
  }
  return [...grupos.entries()].map(([name, value]) => ({ name, value }));
}

function statusBadgeColor(status: string) {
  switch (status) {
    case "confirmada":
    case "concluida":
      return "text-[var(--success-text)] bg-[var(--success-bg)]";
    case "cancelada":
      return "text-[var(--danger-text)] bg-[var(--danger-bg)]";
    case "pendente":
      return "text-[var(--warning-text)] bg-[var(--warning-bg)]";
    default:
      return "text-[var(--text-secondary)] bg-[var(--bg-overlay)]";
  }
}

export function DashboardClient() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("mes");
  const [stats, setStats] = useState<Stats>(initialStats);
  const [financial, setFinancial] = useState<Financial>(initialFinancial);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [sellers, setSellers] = useState<TopSeller[]>([]);
  const [chartData, setChartData] = useState<{ label: string; valor: number }[]>([]);
  const [donutData, setDonutData] = useState<{ name: string; value: number }[]>([]);
  const [embarqueAlerts, setEmbarqueAlerts] = useState<EmbarqueAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async (p: Period) => {
    if (!profile) return;
    const range = getDateRange(p);
    try {
      const [s, f, r, t, c, d, e] = await Promise.all([
        loadStats(profile, range),
        loadFinancial(profile),
        loadRecentSales(profile, range),
        loadTopSellers(profile, range),
        loadSalesByDay(profile, range),
        loadRevenueByCategory(profile, range),
        loadEmbarqueAlerts(profile),
      ]);
      setStats(s);
      setFinancial(f);
      setRecent(r);
      setSellers(t);
      setChartData(c);
      setDonutData(d);
      setEmbarqueAlerts(e);
    } catch (err) {
      console.error("[dashboard] erro:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    loadAll(period);
    const id = setInterval(() => loadAll(period), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadAll, period]);

  useEffect(() => {
    // carrega dismisseds do localStorage
    const next = new Set<string>();
    try {
      for (const a of embarqueAlerts) {
        const k = dismissKey(a);
        if (typeof window !== "undefined" && window.localStorage.getItem(k) === "1") next.add(k);
      }
    } catch {
      // ignore
    }
    setDismissed(next);
  }, [embarqueAlerts]);

  const totalDonut = useMemo(() => donutData.reduce((sum, d) => sum + d.value, 0), [donutData]);
  const visibleAlerts = useMemo(
    () => embarqueAlerts.filter((a) => !dismissed.has(dismissKey(a))).slice(0, 3),
    [embarqueAlerts, dismissed],
  );

  const handleDismiss = (a: EmbarqueAlert) => {
    const k = dismissKey(a);
    setDismissed((prev) => new Set(prev).add(k));
    try {
      window.localStorage.setItem(k, "1");
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Topbar />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <PeriodFilter value={period} onChange={setPeriod} />
        {!loading && visibleAlerts.length > 0 && (
          <div className="space-y-2">
            {visibleAlerts.map((a) => {
              const title = embarqueAlertTitle(a.diffDays);
              const subtitle = [a.cliente_nome ?? a.destino ?? "—", `#${a.numero_venda}`, a.data_ida].filter(Boolean).join(" · ");
              return (
                <div
                  key={`${a.venda_id}:${a.diffDays}`}
                  className="flex items-start justify-between gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--accent-glow)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--accent-700)]">{title}</p>
                    <p className="truncate text-xs text-[var(--accent-700)]/80">{subtitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <BackofficeLink
                      href="/backoffice/embarques/"
                      className="rounded-md bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      Ver embarques
                    </BackofficeLink>
                    <button
                      type="button"
                      onClick={() => handleDismiss(a)}
                      className="rounded-md p-2 text-[var(--accent-700)]/70 transition-colors hover:bg-black/5 hover:text-[var(--accent-700)]"
                      aria-label="Fechar aviso"
                      title="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total de Clientes" value={loading ? null : String(stats.totalClientes)} icon={Users} tone="purple" />
          <StatCard label="Vendas no período" value={loading ? null : String(stats.totalVendas)} icon={ShoppingCart} tone="green" trend={loading ? undefined : (stats.trendVendas ?? undefined)} trendLabel={getDateRange(period).trendLabel} />
          <StatCard label="Faturamento no período" value={loading ? null : formatCurrency(stats.faturamentoTotal)} icon={Wallet} tone="beige" trend={loading ? undefined : (stats.trendFaturamento ?? undefined)} trendLabel={getDateRange(period).trendLabel} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Relatório de Vendas ({PERIODS.find((p) => p.value === period)?.label ?? ""})</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <SalesBarChart data={chartData} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Distribuição de Receita</CardTitle>
              <BackofficeLink href="/backoffice/relatorios/" className="text-xs text-[var(--accent-600)] hover:underline">
                Ver detalhes
              </BackofficeLink>
            </CardHeader>
            <CardContent className="h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <RevenueDonut data={donutData} centerLabel={formatCurrency(totalDonut)} />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Últimas Vendas</CardTitle>
              <BackofficeLink href="/backoffice/vendas/" className="text-xs text-[var(--accent-600)] hover:underline">
                Ver todas
              </BackofficeLink>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma venda encontrada.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((sale) => (
                    <li key={sale.id} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {relName(sale.clientes) ?? sale.destino ?? "—"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          #{sale.numero_venda}
                          <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${statusBadgeColor(sale.status)}`}>
                            {sale.status}
                          </span>
                        </p>
                      </div>
                      <p className="font-semibold text-foreground">{formatCurrency(Number(sale.valor_total))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle>Top Vendedores</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : sellers.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
                  {profile && ["administrador", "gerente"].includes(profile.tipo)
                    ? "Nenhuma venda neste mês."
                    : "Disponível apenas para administradores e gerentes."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {sellers.map((s, i) => (
                    <li key={`${s.nome}-${i}`} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-glow)] text-xs font-semibold text-[var(--accent-600)]">
                        {i + 1}º
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.nome}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{s.vendas} venda(s)</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(s.total)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FinancialCard
            label="A Receber"
            value={loading ? null : formatCurrency(financial.contasReceberValor)}
            count={loading ? null : `${financial.contasReceberCount} conta${financial.contasReceberCount !== 1 ? "s" : ""}`}
            href="/backoffice/financeiro/?tab=receber"
            tone="positive"
          />
          <FinancialCard
            label="A Pagar"
            value={loading ? null : financial.contasPagarValor !== null ? formatCurrency(financial.contasPagarValor) : "—"}
            count={loading ? null : financial.contasPagarValor !== null ? `${financial.contasPagarCount} conta${(financial.contasPagarCount ?? 0) !== 1 ? "s" : ""}` : "Acesso restrito"}
            href="/backoffice/financeiro/?tab=pagar"
            tone="negative"
          />
          {profile && !["administrador", "gerente"].includes(profile.tipo) && (
            <FinancialCard
              label="Minhas Comissões"
              value={loading ? null : financial.comissaoPendenteValor !== null ? formatCurrency(financial.comissaoPendenteValor) : "—"}
              count={loading ? null : financial.comissaoPendenteCount !== null ? `${financial.comissaoPendenteCount} pendente${(financial.comissaoPendenteCount ?? 0) !== 1 ? "s" : ""}` : "—"}
              href="/backoffice/financeiro/?tab=comissoes"
              tone="commission"
            />
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value, icon: Icon, tone = "green", trend, trendLabel = "vs período anterior" }: {
  label: string; value: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "purple" | "green" | "beige";
  trend?: number;
  trendLabel?: string;
}) {
  const toneClasses = {
    purple: "bg-[var(--purple-glow)] text-[var(--purple-700)]",
    green: "bg-[var(--accent-glow)] text-[var(--accent-600)]",
    beige: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  } as const;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</span>
        </div>
        {value === null ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-semibold text-foreground">{value}</p>}
        {trend !== undefined && (
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${trend >= 0 ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] text-[var(--danger-text)]"}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-[var(--text-secondary)]">{trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === p.value
              ? "bg-(--accent-600) text-white shadow-sm"
              : "border border-(--border-subtle) bg-secondary text-muted-foreground hover:bg-(--bg-hover) hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function FinancialCard({ label, value, count, href, tone }: {
  label: string; value: string | null; count: string | null; href: string; tone: "positive" | "negative" | "commission";
}) {
  const Icon = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : Wallet;
  const toneClass = tone === "positive"
    ? "bg-[var(--success-bg)] text-[var(--success-text)]"
    : tone === "negative"
      ? "bg-[var(--danger-bg)] text-[var(--danger-text)]"
      : "bg-[var(--purple-glow)] text-[var(--purple-700)]";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
          {value === null ? <Skeleton className="mt-1 h-6 w-32" /> : <p className="text-lg font-semibold text-foreground">{value}</p>}
          {count === null ? <Skeleton className="mt-1 h-4 w-24" /> : <p className="text-xs text-[var(--text-secondary)]">{count}</p>}
        </div>
        <BackofficeLink href={href} className="rounded-md border border-[var(--border-subtle)] bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--bg-hover)]">
          Ver
        </BackofficeLink>
      </CardContent>
    </Card>
  );
}
