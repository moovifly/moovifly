"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
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
type Stats = { totalClientes: number; totalVendas: number; faturamentoTotal: number };
type Financial = {
  contasReceberValor: number;
  contasReceberCount: number;
  contasPagarValor: number | null;
  contasPagarCount: number | null;
};

const initialStats: Stats = { totalClientes: 0, totalVendas: 0, faturamentoTotal: 0 };
const initialFinancial: Financial = {
  contasReceberValor: 0,
  contasReceberCount: 0,
  contasPagarValor: null,
  contasPagarCount: null,
};

async function loadStats(profile: UserProfile): Promise<Stats> {
  const supabase = getSupabaseClient();
  let clientesQ = supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativo");
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    clientesQ = clientesQ.eq("vendedor_id", profile.id);
  }
  const { count: totalClientes } = await clientesQ;

  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  let vendasQ = supabase
    .from("vendas")
    .select("id, valor_total", { count: "exact" })
    .gte("created_at", firstDayOfMonth)
    .in("status", ["confirmada", "concluida"]);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    vendasQ = vendasQ.eq("vendedor_id", profile.id);
  }
  const { data: vendas, count: totalVendas } = await vendasQ;
  const faturamentoTotal =
    vendas?.reduce((sum: number, v: { valor_total?: number | string | null }) => sum + Number.parseFloat(String(v.valor_total ?? 0)), 0) ?? 0;

  return { totalClientes: totalClientes ?? 0, totalVendas: totalVendas ?? 0, faturamentoTotal };
}

async function loadRecentSales(profile: UserProfile): Promise<RecentSale[]> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from("vendas")
    .select("id, numero_venda, destino, valor_total, status, clientes (nome)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RecentSale[];
}

async function loadTopSellers(profile: UserProfile): Promise<TopSeller[]> {
  if (!["administrador", "gerente"].includes(profile.tipo)) return [];
  const supabase = getSupabaseClient();
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: vendas, error } = await supabase
    .from("vendas")
    .select("vendedor_id, valor_total, usuarios (nome)")
    .gte("created_at", firstDayOfMonth)
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

  return {
    contasReceberValor: totalReceber,
    contasReceberCount: contasReceber?.length ?? 0,
    contasPagarValor: totalPagar,
    contasPagarCount: countPagar,
  };
}

async function loadSalesByDay(profile: UserProfile, days = 7) {
  const supabase = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  let q = supabase
    .from("vendas")
    .select("valor_total, created_at, status")
    .gte("created_at", since.toISOString())
    .in("status", ["confirmada", "concluida"]);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }
  const { data } = await q;
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const v of (data ?? []) as Array<{ valor_total: number | string; created_at: string }>) {
    const key = new Date(v.created_at).toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + Number.parseFloat(String(v.valor_total ?? 0)));
  }
  return [...buckets.entries()].map(([date, value]) => ({
    label: new Date(date).toLocaleDateString("pt-BR", { weekday: "short" }),
    valor: value,
  }));
}

async function loadRevenueByCategory(profile: UserProfile) {
  const supabase = getSupabaseClient();
  let q = supabase.from("vendas").select("tipo, valor_total, status").in("status", ["confirmada", "concluida"]);
  if (!["administrador", "gerente"].includes(profile.tipo)) {
    q = q.eq("vendedor_id", profile.id);
  }
  const { data } = await q;
  const grupos = new Map<string, number>();
  for (const v of (data ?? []) as Array<{ tipo: string | null; valor_total: number | string | null }>) {
    const key = v.tipo ?? "Outros";
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
  const [stats, setStats] = useState<Stats>(initialStats);
  const [financial, setFinancial] = useState<Financial>(initialFinancial);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [sellers, setSellers] = useState<TopSeller[]>([]);
  const [chartData, setChartData] = useState<{ label: string; valor: number }[]>([]);
  const [donutData, setDonutData] = useState<{ name: string; value: number }[]>([]);

  const loadAll = useCallback(async () => {
    if (!profile) return;
    try {
      const [s, f, r, t, c, d] = await Promise.all([
        loadStats(profile),
        loadFinancial(profile),
        loadRecentSales(profile),
        loadTopSellers(profile),
        loadSalesByDay(profile),
        loadRevenueByCategory(profile),
      ]);
      setStats(s);
      setFinancial(f);
      setRecent(r);
      setSellers(t);
      setChartData(c);
      setDonutData(d);
    } catch (err) {
      console.error("[dashboard] erro:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadAll]);

  const totalDonut = useMemo(() => donutData.reduce((sum, d) => sum + d.value, 0), [donutData]);

  return (
    <>
      <Topbar />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total de Clientes" value={loading ? null : String(stats.totalClientes)} icon={Users} tone="purple" trend={20} />
          <StatCard label="Vendas no mês" value={loading ? null : String(stats.totalVendas)} icon={ShoppingCart} tone="green" trend={-8} />
          <StatCard label="Faturamento no mês" value={loading ? null : formatCurrency(stats.faturamentoTotal)} icon={Wallet} tone="beige" trend={20} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Relatório de Vendas (últimos 7 dias)</CardTitle>
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
              <Link href="/backoffice/relatorios/" className="text-xs text-[var(--accent-600)] hover:underline">
                Ver detalhes
              </Link>
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
              <Link href="/backoffice/vendas/" className="text-xs text-[var(--accent-600)] hover:underline">
                Ver todas
              </Link>
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

        <section className="grid gap-4 sm:grid-cols-2">
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
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value, icon: Icon, tone = "green", trend }: {
  label: string; value: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "purple" | "green" | "beige"; trend?: number;
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
            <span className="text-[var(--text-secondary)]">vs último mês</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinancialCard({ label, value, count, href, tone }: {
  label: string; value: string | null; count: string | null; href: string; tone: "positive" | "negative";
}) {
  const Icon = tone === "positive" ? ArrowUpRight : ArrowDownRight;
  const toneClass = tone === "positive"
    ? "bg-[var(--success-bg)] text-[var(--success-text)]"
    : "bg-[var(--danger-bg)] text-[var(--danger-text)]";

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
        <Link href={href} className="rounded-md border border-[var(--border-subtle)] bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--bg-hover)]">
          Ver
        </Link>
      </CardContent>
    </Card>
  );
}
