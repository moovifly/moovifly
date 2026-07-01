"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { FinancePeriodFilter } from "@/components/financeiro/finance-period-filter";
import { FinanceiroNav } from "@/components/financeiro/financeiro-nav";
import {
  FluxoEntradasSaidasBarChart,
  FluxoSaldoLineChart,
} from "@/components/financeiro/fluxo-caixa-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/format";
import {
  aggregateCashflow,
  buildFluxoPorConta,
  toFluxoMovement,
  type ContaBancariaResumo,
  type FluxoCaixaResult,
  type FluxoMovement,
} from "@/lib/financial/fluxo-caixa";
import { defaultFinancePeriod } from "@/lib/financial/period";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { cn } from "@/lib/utils";

type ContaBancaria = {
  id: string;
  nome: string;
  banco: string | null;
  cor: string;
  saldo_inicial: number;
};

export function FluxoCaixaClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [period, setPeriod] = useState(defaultFinancePeriod);
  const [loading, setLoading] = useState(true);
  const [consolidado, setConsolidado] = useState<FluxoCaixaResult | null>(null);
  const [contasResumo, setContasResumo] = useState<ContaBancariaResumo[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [activeTab, setActiveTab] = useState("consolidado");

  const isManager = profile && ["administrador", "gerente"].includes(profile.tipo);

  async function load() {
    if (!isManager) return;
    setLoading(true);
    try {
      const [{ data: recebidas }, { data: pagas }, { data: contasBancarias }] = await Promise.all([
          supabase
            .from("contas_receber")
            .select("valor, data_recebimento, conta_bancaria_id")
            .eq("status", "recebida")
            .gte("data_recebimento", period.start)
            .lte("data_recebimento", period.end),
          supabase
            .from("contas_pagar")
            .select("valor, data_pagamento, conta_bancaria_id")
            .eq("status", "paga")
            .gte("data_pagamento", period.start)
            .lte("data_pagamento", period.end),
          supabase
            .from("contas_bancarias")
            .select("id, nome, banco, cor, saldo_inicial")
            .eq("ativa", true)
            .order("nome"),
        ]);

      type RecebidaRow = { valor: number | string; data_recebimento: string | null; conta_bancaria_id: string | null };
      type PagaRow = {
        valor: number | string;
        data_pagamento: string | null;
        conta_bancaria_id: string | null;
      };

      const recebidasRows = (recebidas ?? []) as RecebidaRow[];
      const pagasRows = (pagas ?? []) as PagaRow[];

      const entradas = recebidasRows
        .map((r) => toFluxoMovement(r.valor, r.data_recebimento, r.conta_bancaria_id))
        .filter((m): m is FluxoMovement => m !== null);

      const saidas = pagasRows
        .map((p) => toFluxoMovement(p.valor, p.data_pagamento, p.conta_bancaria_id))
        .filter((m): m is FluxoMovement => m !== null);

      const fluxoConsolidado = aggregateCashflow(entradas, saidas, period.start, period.end);
      setConsolidado(fluxoConsolidado);

      const contasAtivas = (contasBancarias ?? []) as ContaBancaria[];
      setContas(contasAtivas);
      setContasResumo(buildFluxoPorConta(contasAtivas, entradas, saidas, period.start, period.end));
    } catch (err) {
      toast.error("Erro ao carregar fluxo de caixa", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, period.start, period.end]);

  const activeData = useMemo(() => {
    if (activeTab === "consolidado") return consolidado;
    const conta = contasResumo.find((c) => c.id === activeTab);
    if (!conta) return null;
    return {
      rows: conta.rows,
      totalEntradas: conta.totalEntradas,
      totalSaidas: conta.totalSaidas,
      saldoAtual: conta.saldoAtual,
    } satisfies FluxoCaixaResult;
  }, [activeTab, consolidado, contasResumo]);

  if (!isManager) {
    return (
      <>
        <Topbar title="Fluxo de Caixa" />
        <div className="p-6 text-sm text-[var(--text-secondary)]">Acesso restrito a administradores e gerentes.</div>
      </>
    );
  }

  const skeleton = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <>
      <Topbar title="Financeiro" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <FinanceiroNav />
        <FinancePeriodFilter period={period} onChange={setPeriod} />

        {contas.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contasResumo.map((conta) => (
              <button
                key={conta.id}
                type="button"
                onClick={() => setActiveTab(conta.id)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors hover:bg-muted/50",
                  activeTab === conta.id && "border-[var(--accent-600)] bg-[var(--accent-glow)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: conta.cor }} />
                  <span className="font-medium">{conta.nome}</span>
                </div>
                {conta.banco && <p className="mt-1 text-xs text-[var(--text-secondary)]">{conta.banco}</p>}
                <p className="mt-2 text-lg font-semibold">{formatCurrency(conta.saldoAtual)}</p>
                <div className="mt-1 flex gap-3 text-xs text-[var(--text-secondary)]">
                  <span className="text-[var(--success-text)]">↑ {formatCurrency(conta.totalEntradas)}</span>
                  <span className="text-[var(--warning-text)]">↓ {formatCurrency(conta.totalSaidas)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          skeleton
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                {contas.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>
                    {c.nome}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeTab} className="mt-4 space-y-4">
                {activeData && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">Entradas</CardTitle>
                          <ArrowDownLeft className="h-4 w-4 text-[var(--success-text)]" />
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-[var(--success-text)]">
                            {formatCurrency(activeData.totalEntradas)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">Saídas</CardTitle>
                          <ArrowUpRight className="h-4 w-4 text-[var(--warning-text)]" />
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-[var(--warning-text)]">
                            {formatCurrency(activeData.totalSaidas)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">Saldo do período</CardTitle>
                          <Wallet className="h-4 w-4 text-[var(--accent-600)]" />
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{formatCurrency(activeData.saldoAtual)}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {activeData.rows.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center text-sm text-[var(--text-secondary)]">
                          Nenhuma movimentação no período selecionado.
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <Card>
                          <CardHeader>
                            <CardTitle>Saldo acumulado</CardTitle>
                          </CardHeader>
                          <CardContent className="h-64">
                            <FluxoSaldoLineChart rows={activeData.rows} />
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Entradas vs saídas</CardTitle>
                          </CardHeader>
                          <CardContent className="h-64">
                            <FluxoEntradasSaidasBarChart rows={activeData.rows} />
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Detalhamento mensal</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Mês</TableHead>
                                  <TableHead>Saldo inicial</TableHead>
                                  <TableHead>Entradas</TableHead>
                                  <TableHead>Saídas</TableHead>
                                  <TableHead>Saldo final</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {activeData.rows.map((row) => (
                                  <TableRow key={row.monthKey}>
                                    <TableCell>{row.monthLabel}</TableCell>
                                    <TableCell>{formatCurrency(row.saldoInicial)}</TableCell>
                                    <TableCell className="text-[var(--success-text)]">
                                      {formatCurrency(row.entradas)}
                                    </TableCell>
                                    <TableCell className="text-[var(--warning-text)]">
                                      {formatCurrency(row.saidas)}
                                    </TableCell>
                                    <TableCell className="font-semibold">{formatCurrency(row.saldoFinal)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>

            {contas.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)]">
                Cadastre contas bancárias em Configurações → Contas Bancárias para ver o fluxo por conta.
                Lançamentos sem conta vinculada aparecem apenas no consolidado.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
