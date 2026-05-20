"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
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
  status: string;
  data_venda: string;
  clientes?: { nome: string } | { nome: string }[] | null;
  usuarios?: { nome: string } | { nome: string }[] | null;
};

type OrcamentoRavDu = {
  rav_du: number | string | null;
  status: string;
  data_orcamento: string;
};

export function RelatoriosClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile, effectiveProfile } = useAuth();

  const isVendedor = effectiveProfile?.tipo === "vendedor";
  const isAdmin = effectiveProfile?.tipo === "administrador";

  const [items, setItems] = useState<Venda[]>([]);
  const [orcRavDu, setOrcRavDu] = useState<OrcamentoRavDu[]>([]);
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
        .select("id, numero_venda, destino, valor_total, taxa_rav, status, data_venda, clientes(nome), usuarios(nome)")
        .gte("data_venda", dateFrom)
        .lte("data_venda", dateTo)
        .order("data_venda", { ascending: false });
      if (statusFilter) qVendas = qVendas.eq("status", statusFilter);

      const [{ data: vendas, error: vendasError }, { data: orcs, error: orcsError }] = await Promise.all([
        qVendas,
        isAdmin
          ? supabase
              .from("orcamentos")
              .select("rav_du, status, data_orcamento")
              .gte("data_orcamento", dateFrom)
              .lte("data_orcamento", dateTo)
          : Promise.resolve({ data: [] as unknown as OrcamentoRavDu[], error: null }),
      ]);

      if (vendasError) throw vendasError;
      if (orcsError) throw orcsError;
      setItems((vendas ?? []) as unknown as Venda[]);
      setOrcRavDu((orcs ?? []) as unknown as OrcamentoRavDu[]);
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
    return orcRavDu
      .filter((o) => ["aprovado", "convertido"].includes(o.status))
      .reduce((sum, o) => sum + Number(o.rav_du ?? 0), 0);
  }, [orcRavDu, isAdmin]);

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
