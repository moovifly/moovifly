"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
import { ChartEmptyState, SimpleBarChart } from "@/components/backoffice/charts/chart-kit";
import { DonutChart } from "@/components/backoffice/charts/donut-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelatoriosVendedor } from "./relatorios-vendedor";

type Venda = {
  id: string;
  numero_venda: string;
  destino: string | null;
  valor_total: number | string;
  taxa_rav: number | string;
  taxa_du: number | string;
  status: string;
  data_venda: string;
  clientes?: { nome: string } | { nome: string }[] | null;
  usuarios?: { nome: string } | { nome: string }[] | null;
};

export function RelatoriosClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile, effectiveProfile } = useAuth();

  const isVendedor = effectiveProfile?.tipo === "vendedor";
  const isAdmin = effectiveProfile?.tipo === "administrador";

  const [items, setItems] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState<string>("mes");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");

  const PRESETS = [
    {
      key: "hoje",
      label: "Hoje",
      range: () => {
        const t = new Date().toISOString().slice(0, 10);
        return { from: t, to: t };
      },
    },
    {
      key: "semana",
      label: "Esta semana",
      range: () => {
        const d = new Date();
        const day = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((day + 6) % 7));
        return { from: mon.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "mes",
      label: "Este mês",
      range: () => {
        const d = new Date();
        return {
          from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10),
          to: d.toISOString().slice(0, 10),
        };
      },
    },
    {
      key: "mes_passado",
      label: "Último mês",
      range: () => {
        const d = new Date();
        const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const last = new Date(d.getFullYear(), d.getMonth(), 0);
        return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
      },
    },
    {
      key: "3meses",
      label: "Últ. 3 meses",
      range: () => {
        const d = new Date();
        const from = new Date(d);
        from.setMonth(d.getMonth() - 3);
        return { from: from.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "6meses",
      label: "Últ. 6 meses",
      range: () => {
        const d = new Date();
        const from = new Date(d);
        from.setMonth(d.getMonth() - 6);
        return { from: from.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "ano",
      label: "Este ano",
      range: () => {
        const d = new Date();
        return {
          from: new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10),
          to: d.toISOString().slice(0, 10),
        };
      },
    },
  ];

  async function load() {
    setLoading(true);
    try {
      let qVendas = supabase
        .from("vendas")
        .select("id, numero_venda, destino, valor_total, taxa_rav, taxa_du, status, data_venda, clientes(nome), usuarios(nome)")
        .gte("data_venda", dateFrom)
        .lte("data_venda", dateTo)
        .order("data_venda", { ascending: false });
      if (statusFilter) qVendas = qVendas.eq("status", statusFilter);

      const { data: vendas, error: vendasError } = await qVendas;

      if (vendasError) throw vendasError;
      setItems((vendas ?? []) as unknown as Venda[]);
    } catch (err) {
      toast.error("Erro ao carregar relatório", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile && !isVendedor) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dateFrom, dateTo, statusFilter, isVendedor]);

  const totalFaturamento = useMemo(
    () =>
      items
        .filter((v) => ["confirmada", "concluida"].includes(v.status))
        .reduce((sum, v) => sum + Number(v.valor_total ?? 0), 0),
    [items],
  );

  const totalRavDu = useMemo(() => {
    if (!isAdmin) return 0;
    return items.reduce(
      (sum, v) => sum + Number(v.taxa_rav ?? 0) + Number(v.taxa_du ?? 0),
      0,
    );
  }, [items, isAdmin]);

  const vendasConfirmadas = useMemo(
    () => items.filter((v) => ["confirmada", "concluida"].includes(v.status)),
    [items],
  );

  // Série de faturamento por dia (ou por mês, em períodos longos) a partir das vendas já carregadas.
  const faturamentoSerie = useMemo(() => {
    const from = new Date(`${dateFrom}T12:00:00`);
    const to = new Date(`${dateTo}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];

    const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    const porMes = diffDays > 45;
    const buckets = new Map<string, number>();

    if (porMes) {
      const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to && buckets.size < 37) {
        buckets.set(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, 0);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
    }

    for (const v of vendasConfirmadas) {
      const key = porMes ? v.data_venda.slice(0, 7) : v.data_venda.slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(v.valor_total ?? 0));
    }

    return [...buckets.entries()].map(([key, value]) => ({
      label: porMes
        ? new Date(`${key}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value,
    }));
  }, [vendasConfirmadas, dateFrom, dateTo]);

  const temFaturamentoSerie = useMemo(() => faturamentoSerie.some((p) => p.value > 0), [faturamentoSerie]);

  // Participação de cada vendedor no faturamento do período (dados já carregados).
  const porVendedor = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vendasConfirmadas) {
      const ven = Array.isArray(v.usuarios) ? v.usuarios[0] : v.usuarios;
      const nome = ven?.nome ?? "Sem vendedor";
      map.set(nome, (map.get(nome) ?? 0) + Number(v.valor_total ?? 0));
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [vendasConfirmadas]);

  if (isVendedor) {
    return (
      <>
        <Topbar
          title="Meus Relatórios"
          subtitle="Suas vendas, comissões e desempenho"
        />
        <RelatoriosVendedor />
      </>
    );
  }

  return (
    <>
      <Topbar title="Relatórios" subtitle={`${items.length} venda${items.length !== 1 ? "s" : ""} encontradas`} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    const { from, to } = p.range();
                    setDateFrom(from);
                    setDateTo(to);
                    setActivePreset(p.key);
                  }}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    activePreset === p.key
                      ? "border-(--color-primary) bg-(--color-primary) text-white"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setActivePreset("");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setActivePreset("");
                  }}
                />
              </div>
              <div className="space-y-1.5 min-w-[160px]">
                <Label>Status</Label>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={["grid gap-4", isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"].join(" ")}>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-[var(--text-secondary)] uppercase">Total de vendas</p>
              <p className="text-2xl font-semibold text-foreground">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-[var(--text-secondary)] uppercase">Faturamento</p>
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(totalFaturamento)}</p>
            </CardContent>
          </Card>
          {isAdmin && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--text-secondary)] uppercase">RAV/DU</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(totalRavDu)}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-[var(--text-secondary)] uppercase">Ticket médio</p>
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(items.length ? totalFaturamento / items.length : 0)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Faturamento no período</CardTitle>
              <span className="text-xs text-[var(--text-secondary)]">vendas confirmadas e concluídas</span>
            </CardHeader>
            <CardContent className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : !temFaturamentoSerie ? (
                <ChartEmptyState
                  icon={BarChart3}
                  title="Sem faturamento no período"
                  description="Ajuste os filtros de data e status para visualizar as vendas."
                />
              ) : (
                <SimpleBarChart data={faturamentoSerie} name="Faturamento" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Faturamento por vendedor</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <DonutChart
                  data={porVendedor}
                  emptyTitle="Sem vendas no período"
                  emptyDescription="A participação por vendedor aparecerá aqui quando houver vendas confirmadas."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Vendas no período</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma venda no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((v) => {
                    const cli = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
                    const ven = Array.isArray(v.usuarios) ? v.usuarios[0] : v.usuarios;
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                        <TableCell>{formatDate(v.data_venda)}</TableCell>
                        <TableCell>{cli?.nome ?? "—"}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{ven?.nome ?? "—"}</TableCell>
                        <TableCell>{v.destino ?? "—"}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(Number(v.valor_total))}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.status === "confirmada" || v.status === "concluida" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : v.status === "cancelada" ? "bg-[var(--danger-bg)] text-[var(--danger-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                            {v.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
