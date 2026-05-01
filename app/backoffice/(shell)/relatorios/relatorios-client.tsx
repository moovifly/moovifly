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
import { formatCurrency, formatDate } from "@/lib/format";

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

export function RelatoriosClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("vendas")
        .select("id, numero_venda, destino, valor_total, taxa_rav, status, data_venda, clientes(nome), usuarios(nome)")
        .gte("data_venda", dateFrom)
        .lte("data_venda", dateTo)
        .order("data_venda", { ascending: false });
      if (statusFilter) q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as unknown as Venda[]);
    } catch (err) {
      toast.error("Erro ao carregar relatório", { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dateFrom, dateTo, statusFilter]);

  const totalFaturamento = useMemo(() => items.filter((v) => ["confirmada", "concluida"].includes(v.status)).reduce((sum, v) => sum + Number(v.valor_total ?? 0), 0), [items]);

  return (
    <>
      <Topbar title="Relatórios" subtitle={`${items.length} venda${items.length !== 1 ? "s" : ""} encontradas`} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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

        <div className="grid gap-4 sm:grid-cols-3">
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
