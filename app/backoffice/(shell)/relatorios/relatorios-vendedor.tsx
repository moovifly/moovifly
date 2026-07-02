"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";

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
import { SalesBarChart } from "../dashboard/dashboard-charts";

type Venda = {
  id: string;
  numero_venda: string;
  destino: string | null;
  valor_total: number | string;
  status: string;
  data_venda: string;
  clientes?: { nome: string } | { nome: string }[] | null;
};

type Comissao = {
  id: string;
  valor_comissao: number | string;
  status: string;
  created_at: string;
  vendas?: { numero_venda: string; destino: string | null } | { numero_venda: string; destino: string | null }[] | null;
};

function statusBadge(status: string) {
  switch (status) {
    case "confirmada":
    case "concluida":
    case "pago":
    case "paga":
      return "bg-[var(--success-bg)] text-[var(--success-text)]";
    case "cancelada":
      return "bg-[var(--danger-bg)] text-[var(--danger-text)]";
    default:
      return "bg-[var(--warning-bg)] text-[var(--warning-text)]";
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    pago: "Pago",
    paga: "Paga",
    confirmada: "Confirmada",
    concluida: "Concluída",
    cancelada: "Cancelada",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

export function RelatoriosVendedor() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [chartData, setChartData] = useState<{ label: string; valor: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dateFrom, dateTo, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("vendas")
        .select("id, numero_venda, destino, valor_total, status, data_venda, clientes(nome)")
        .gte("data_venda", dateFrom)
        .lte("data_venda", dateTo)
        .order("data_venda", { ascending: false });
      if (statusFilter) q = q.eq("status", statusFilter);

      const { data: vendasData, error: vendasErr } = await q;
      if (vendasErr) throw vendasErr;
      setVendas((vendasData ?? []) as unknown as Venda[]);

      const { data: comissoesData, error: comErr } = await supabase
        .from("comissoes")
        .select("id, valor_comissao, status, created_at, vendas!inner(numero_venda, destino, data_venda)")
        .gte("vendas.data_venda", dateFrom)
        .lte("vendas.data_venda", dateTo)
        .order("created_at", { ascending: false });
      if (comErr) throw comErr;
      setComissoes((comissoesData ?? []) as unknown as Comissao[]);

      await loadChart();
    } catch (err) {
      toast.error("Erro ao carregar relatório", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  async function loadChart() {
    const days = 14;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await supabase
      .from("vendas")
      .select("valor_total, created_at, status")
      .gte("created_at", since.toISOString())
      .in("status", ["confirmada", "concluida"]);

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
    setChartData(
      [...buckets.entries()].map(([date, value]) => ({
        label: new Date(date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
        valor: value,
      })),
    );
  }

  const vendasConfirmadas = useMemo(
    () => vendas.filter((v) => ["confirmada", "concluida"].includes(v.status)),
    [vendas],
  );
  const faturamento = useMemo(
    () => vendasConfirmadas.reduce((sum, v) => sum + Number(v.valor_total ?? 0), 0),
    [vendasConfirmadas],
  );
  const ticketMedio = vendasConfirmadas.length ? faturamento / vendasConfirmadas.length : 0;
  const comissaoTotal = useMemo(
    () => comissoes.reduce((sum, c) => sum + Number(c.valor_comissao ?? 0), 0),
    [comissoes],
  );
  const comissaoPendente = useMemo(
    () =>
      comissoes
        .filter((c) => c.status === "pendente")
        .reduce((sum, c) => sum + Number(c.valor_comissao ?? 0), 0),
    [comissoes],
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Vendas no período"
          value={loading ? null : String(vendasConfirmadas.length)}
          icon={ShoppingCart}
          tone="green"
        />
        <SummaryCard
          label="Faturamento"
          value={loading ? null : formatCurrency(faturamento)}
          icon={DollarSign}
          tone="blue"
        />
        <SummaryCard
          label="Ticket médio"
          value={loading ? null : formatCurrency(ticketMedio)}
          icon={TrendingUp}
          tone="beige"
        />
        <SummaryCard
          label="Comissão pendente"
          value={loading ? null : formatCurrency(comissaoPendente)}
          icon={Award}
          tone="purple"
        />
      </section>

      {/* Performance chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Meu Desempenho (últimos 14 dias)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <SalesBarChart data={chartData} />
          )}
        </CardContent>
      </Card>

      {/* Filtros + tabela de vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Minhas Vendas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="min-w-[160px] space-y-1.5">
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

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : vendas.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Nenhuma venda no período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((v) => {
                  const cli = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                      <TableCell>{formatDate(v.data_venda)}</TableCell>
                      <TableCell>{cli?.nome ?? "—"}</TableCell>
                      <TableCell>{v.destino ?? "—"}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(Number(v.valor_total))}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(v.status)}`}>
                          {statusLabel(v.status)}
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

      {/* Comissões */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Minhas Comissões</CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--text-secondary)]">Total recebido:</span>
            <span className="font-semibold text-foreground">{formatCurrency(comissaoTotal - comissaoPendente)}</span>
            <span className="text-[var(--text-secondary)]">Pendente:</span>
            <span className="font-semibold text-[var(--warning-text)]">{formatCurrency(comissaoPendente)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : comissoes.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Nenhuma comissão registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoes.map((c) => {
                  const venda = Array.isArray(c.vendas) ? c.vendas[0] : c.vendas;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{venda?.numero_venda ?? "—"}</TableCell>
                      <TableCell>{venda?.destino ?? "—"}</TableCell>
                      <TableCell>{formatDate(c.created_at)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(Number(c.valor_comissao))}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(c.status)}`}>
                          {statusLabel(c.status)}
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
  );
}

type Tone = "green" | "blue" | "beige" | "purple";

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  const toneMap: Record<Tone, string> = {
    green: "bg-[var(--accent-glow)] text-[var(--accent-600)]",
    blue: "bg-[var(--accent-glow)] text-[var(--accent-600)]",
    beige: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
    purple: "bg-[var(--purple-glow)] text-[var(--purple-700)]",
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
          {value === null ? (
            <Skeleton className="mt-1 h-6 w-24" />
          ) : (
            <p className="text-xl font-semibold text-foreground">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
