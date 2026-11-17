"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart3, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
import { MobileCardList } from "@/components/backoffice/mobile-card-list";
import { ChartEmptyState, SimpleBarChart } from "@/components/backoffice/charts/chart-kit";
import { DonutChart } from "@/components/backoffice/charts/donut-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate, formatDocumento } from "@/lib/format";
import { ComissaoEmpresaCard } from "@/components/financeiro/comissao-empresa-card";
import {
  EMPTY_COMISSAO_EMPRESA,
  aggregateComissaoEmpresa,
  type ComissaoVendedorEmpresa,
} from "@/lib/financial/comissao-empresa";
import { RelatoriosVendedor } from "./relatorios-vendedor";

const PAGE_SIZE = 30;

type ClienteResumo = {
  nome: string;
  cpf: string | null;
  tipo_documento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};

type Venda = {
  id: string;
  numero_venda: string;
  destino: string | null;
  tipo: string | null;
  valor_total: number | string;
  taxa_rav: number | string;
  taxa_du: number | string;
  status: string;
  data_venda: string;
  categoria_venda: "aereo" | "seguro_viagem" | "servico" | null;
  forma_pagamento: string | null;
  fornecedor: string | null;
  clientes?: ClienteResumo | ClienteResumo[] | null;
  usuarios?: { nome: string } | { nome: string }[] | null;
};

const PRODUTO_LABEL: Record<string, string> = {
  aereo: "Aéreo",
  seguro_viagem: "Seguro",
  servico: "Serviço",
};

function categoriaLabel(cat: string | null | undefined) {
  if (!cat) return "—";
  return PRODUTO_LABEL[cat] ?? cat;
}

function vendaResumo(v: Venda) {
  if (v.categoria_venda === "servico") return v.tipo ?? "Serviço";
  if (v.categoria_venda === "seguro_viagem") return v.destino ?? "Seguro Viagem";
  return v.destino ?? "—";
}

function textoOuTraco(value: string | null | undefined) {
  const texto = (value ?? "").trim();
  return texto || "—";
}

export function RelatoriosClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile, effectiveProfile } = useAuth();

  const isVendedor = effectiveProfile?.tipo === "vendedor";
  const isAdmin = effectiveProfile?.tipo === "administrador";

  const [items, setItems] = useState<Venda[]>([]);
  const [comissoesVendedor, setComissoesVendedor] = useState<ComissaoVendedorEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState<string>("mes");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

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
      const baseSelect =
        "id, numero_venda, destino, tipo, valor_total, taxa_rav, taxa_du, status, data_venda, categoria_venda, forma_pagamento, fornecedor, clientes(nome, cpf, tipo_documento, endereco, cidade, estado, cep), usuarios(nome)";
      const adminSelect = `${baseSelect}, comissoes(venda_id, valor_comissao, status)`;

      const fetchVendas = (select: string) => {
        let q = supabase
          .from("vendas")
          .select(select)
          .gte("data_venda", dateFrom)
          .lte("data_venda", dateTo)
          .order("data_venda", { ascending: false });
        if (statusFilter) q = q.eq("status", statusFilter);
        return q;
      };

      let { data: vendas, error: vendasError } = await fetchVendas(isAdmin ? adminSelect : baseSelect);
      if (vendasError && isAdmin) {
        const retry = await fetchVendas(baseSelect);
        vendas = retry.data;
        vendasError = retry.error;
      }
      if (vendasError) throw vendasError;

      const rows = (vendas ?? []) as unknown as Array<Venda & { comissoes?: ComissaoVendedorEmpresa[] | null }>;
      setItems(rows);

      const comissoes: ComissaoVendedorEmpresa[] = [];
      if (isAdmin) {
        for (const v of rows) {
          for (const c of v.comissoes ?? []) {
            comissoes.push({
              venda_id: c.venda_id ?? v.id,
              valor_comissao: c.valor_comissao,
              status: c.status,
            });
          }
        }
      }
      setComissoesVendedor(comissoes);
    } catch (err) {
      toast.error("Erro ao carregar relatório", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile && !isVendedor) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dateFrom, dateTo, statusFilter, isVendedor, isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [items, currentPage],
  );

  const totalFaturamento = useMemo(
    () =>
      items
        .filter((v) => ["confirmada", "concluida"].includes(v.status))
        .reduce((sum, v) => sum + Number(v.valor_total ?? 0), 0),
    [items],
  );

  const totalRavDu = useMemo(() => {
    if (!isAdmin) return 0;
    return items.reduce((sum, v) => {
      if (v.categoria_venda === "seguro_viagem") {
        return sum + Number(v.valor_total ?? 0) * 0.4;
      }
      // Aéreo e Serviço: soma de RAV + DU
      return sum + Number(v.taxa_rav ?? 0) + Number(v.taxa_du ?? 0);
    }, 0);
  }, [items, isAdmin]);

  const comissaoEmpresa = useMemo(() => {
    if (!isAdmin) return EMPTY_COMISSAO_EMPRESA;
    return aggregateComissaoEmpresa(items, comissoesVendedor);
  }, [isAdmin, items, comissoesVendedor]);

  const vendasConfirmadas = useMemo(
    () => items.filter((v) => ["confirmada", "concluida"].includes(v.status)),
    [items],
  );

  const porCategoria = useMemo(() => {
    const order = ["aereo", "seguro_viagem", "servico"] as const;
    const map = new Map<string, { count: number; valor: number }>();
    for (const key of order) map.set(key, { count: 0, valor: 0 });

    for (const v of vendasConfirmadas) {
      const key = v.categoria_venda && order.includes(v.categoria_venda as typeof order[number])
        ? v.categoria_venda
        : "aereo";
      const prev = map.get(key) ?? { count: 0, valor: 0 };
      map.set(key, {
        count: prev.count + 1,
        valor: prev.valor + Number(v.valor_total ?? 0),
      });
    }

    return order.map((key) => {
      const count = map.get(key)?.count ?? 0;
      const value = map.get(key)?.valor ?? 0;
      return {
        key,
        name: PRODUTO_LABEL[key],
        count,
        value,
      };
    });
  }, [vendasConfirmadas]);

  /** Ticket médio por produto com base em vendas confirmadas/concluídas. */
  const ticketMedioPorProduto = useMemo(() => {
    const order = ["aereo", "seguro_viagem", "servico"] as const;
    const map = new Map<string, { count: number; valor: number }>();
    for (const key of order) map.set(key, { count: 0, valor: 0 });

    for (const v of vendasConfirmadas) {
      const key = v.categoria_venda && order.includes(v.categoria_venda as typeof order[number])
        ? v.categoria_venda
        : "aereo";
      const prev = map.get(key) ?? { count: 0, valor: 0 };
      map.set(key, {
        count: prev.count + 1,
        valor: prev.valor + Number(v.valor_total ?? 0),
      });
    }

    return order.map((key) => {
      const count = map.get(key)?.count ?? 0;
      const value = map.get(key)?.valor ?? 0;
      return {
        key,
        name: PRODUTO_LABEL[key],
        count,
        ticketMedio: count > 0 ? value / count : 0,
      };
    });
  }, [vendasConfirmadas]);

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

  async function exportarExcel() {
    const ExcelJS = (await import("exceljs")).default;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Relatório Contador");

    ws.columns = [
      { key: "cliente", width: 38 },
      { key: "documento", width: 22 },
      { key: "endereco", width: 46 },
      { key: "cidade", width: 22 },
      { key: "estado", width: 10 },
      { key: "cep", width: 14 },
      { key: "produto", width: 14 },
      { key: "pagamento", width: 34 },
      { key: "valor", width: 16 },
    ];

    const headerRow = ws.addRow(["CLIENTE", "DOCUMENTO", "ENDEREÇO", "CIDADE", "UF", "CEP", "PRODUTO", "PAGAMENTO", "VALOR"]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1B5E20" } },
        bottom: { style: "thin", color: { argb: "FF1B5E20" } },
        left: { style: "thin", color: { argb: "FF1B5E20" } },
        right: { style: "thin", color: { argb: "FF1B5E20" } },
      };
    });
    headerRow.height = 22;

    let totalGeral = 0;

    for (const v of items) {
      const cli = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
      const nome = cli?.nome ?? "—";
      const documento = textoOuTraco(formatDocumento(cli?.cpf, cli?.tipo_documento));
      const endereco = textoOuTraco(cli?.endereco);
      const cidade = textoOuTraco(cli?.cidade);
      const estado = textoOuTraco(cli?.estado);
      const cep = textoOuTraco(cli?.cep);
      const produto = categoriaLabel(v.categoria_venda);
      const pagamento = v.forma_pagamento ?? "—";
      const valor = v.categoria_venda === "seguro_viagem"
        ? Number(v.valor_total ?? 0) * 0.4
        : Number(v.taxa_rav ?? 0) + Number(v.taxa_du ?? 0);
      totalGeral += valor;

      const row = ws.addRow([nome, documento, endereco, cidade, estado, cep, produto, pagamento, valor]);
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(2).numFmt = "@";
      row.getCell(3).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      row.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(9).numFmt = 'R$ #,##0.00';
      row.getCell(9).alignment = { horizontal: "right", vertical: "middle" };

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD0D0D0" } },
          bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
          left: { style: "thin", color: { argb: "FFD0D0D0" } },
          right: { style: "thin", color: { argb: "FFD0D0D0" } },
        };
        cell.font = { size: 11 };
      });
    }

    ws.addRow([]);

    const totalRow = ws.addRow(["", "", "", "", "", "", "", "TOTAL", totalGeral]);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNumber) => {
      if (colNumber >= 8) {
        cell.font = { bold: true, size: 12, color: { argb: "FF1B5E20" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
        cell.border = {
          top: { style: "thin", color: { argb: "FF2E7D32" } },
          bottom: { style: "thin", color: { argb: "FF2E7D32" } },
          left: { style: "thin", color: { argb: "FF2E7D32" } },
          right: { style: "thin", color: { argb: "FF2E7D32" } },
        };
      }
      if (colNumber === 8) cell.alignment = { horizontal: "left", vertical: "middle" };
      if (colNumber === 9) {
        cell.numFmt = 'R$ #,##0.00';
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-contador_${dateFrom}_${dateTo}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado com sucesso!");
  }

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
                      ? "border-(--accent-solid) bg-(--accent-solid) text-white"
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
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={exportarExcel}
                  disabled={loading || items.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-(--accent-600) bg-card px-4 py-2 text-sm font-medium text-(--accent-600) transition-colors hover:bg-(--accent-solid) hover:border-(--accent-solid) hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </button>
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
                <p className="text-xs text-[var(--text-secondary)] uppercase">RAV/DU + Seguro</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(totalRavDu)}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-[var(--text-secondary)] uppercase">Ticket médio</p>
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(vendasConfirmadas.length ? totalFaturamento / vendasConfirmadas.length : 0)}</p>
            </CardContent>
          </Card>
        </div>

        {isAdmin && (
          <ComissaoEmpresaCard
            data={comissaoEmpresa}
            loading={loading}
            periodLabel="Após taxas de cartão e comissões dos vendedores · vendas confirmadas/concluídas"
          />
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {porCategoria.map((cat) => (
            <Card key={cat.key}>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-[var(--text-secondary)]">{cat.name}</p>
                <p className="text-2xl font-semibold text-foreground">{cat.count}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatCurrency(cat.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Ticket médio por produto</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {ticketMedioPorProduto.map((cat) => (
              <Card key={cat.key}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-[var(--text-secondary)]">{cat.name}</p>
                  <p className="text-2xl font-semibold text-foreground">{formatCurrency(cat.ticketMedio)}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {cat.count} venda{cat.count !== 1 ? "s" : ""} confirmada{cat.count !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
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
              <>
                <MobileCardList
                  rows={paginated.map((v) => {
                    const cli = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
                    const ven = Array.isArray(v.usuarios) ? v.usuarios[0] : v.usuarios;
                    return {
                      key: v.id,
                      title: v.numero_venda,
                      subtitle: cli?.nome ?? "—",
                      value: formatCurrency(Number(v.valor_total)),
                      details: [
                        { label: "Data", value: formatDate(v.data_venda) },
                        { label: "Tipo", value: categoriaLabel(v.categoria_venda) },
                        { label: "Vendedor", value: ven?.nome ?? "—" },
                        { label: "Detalhe", value: vendaResumo(v) },
                      ],
                      badge: (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.status === "confirmada" || v.status === "concluida" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : v.status === "cancelada" ? "bg-[var(--danger-bg)] text-[var(--danger-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                          {v.status}
                        </span>
                      ),
                    };
                  })}
                />
                <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalhe</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((v) => {
                    const cli = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
                    const ven = Array.isArray(v.usuarios) ? v.usuarios[0] : v.usuarios;
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                        <TableCell>{formatDate(v.data_venda)}</TableCell>
                        <TableCell>{cli?.nome ?? "—"}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{ven?.nome ?? "—"}</TableCell>
                        <TableCell>{categoriaLabel(v.categoria_venda)}</TableCell>
                        <TableCell>{vendaResumo(v)}</TableCell>
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
                </div>
              </>
            )}
          </CardContent>
          {!loading && items.length > PAGE_SIZE && (
            <div className="flex flex-col items-center gap-3 border-t border-[var(--border-default)] px-4 py-4 sm:flex-row sm:justify-between sm:gap-4 sm:px-6">
              <p className="text-sm text-[var(--text-secondary)]">
                Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, items.length)} de {items.length} venda{items.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
