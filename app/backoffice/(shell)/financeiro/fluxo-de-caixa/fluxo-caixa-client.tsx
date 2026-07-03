"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { FinanceComposedChart } from "@/components/backoffice/charts/finance-composed-chart";
import { FinancePeriodFilter } from "@/components/financeiro/finance-period-filter";
import { FinanceiroNav } from "@/components/financeiro/financeiro-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/format";
import {
  daysBetweenInclusive,
  type ContaBancariaResumo,
  type FluxoCaixaPayload,
  type FluxoCaixaResult,
} from "@/lib/financial/fluxo-caixa";
import { defaultFinancePeriod } from "@/lib/financial/period";
import { cn } from "@/lib/utils";

type ContaBancaria = FluxoCaixaPayload["contas"][number];

export function FluxoCaixaClient() {
  const pathname = usePathname();
  const { profile, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState(defaultFinancePeriod);
  const [loading, setLoading] = useState(true);
  const [consolidado, setConsolidado] = useState<FluxoCaixaResult | null>(null);
  const [contasResumo, setContasResumo] = useState<ContaBancariaResumo[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [activeTab, setActiveTab] = useState("consolidado");

  const isManager = profile && ["administrador", "gerente"].includes(profile.tipo);
  const detalhePorDia = daysBetweenInclusive(period.start, period.end) <= 45;

  const load = useCallback(async () => {
    if (!isManager) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ start: period.start, end: period.end });
      const res = await fetch(`/api/financial/fluxo-caixa/?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as FluxoCaixaPayload & { error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setConsolidado(json.consolidado);
      setContas(json.contas ?? []);
      setContasResumo(json.contasResumo ?? []);
    } catch (err) {
      toast.error("Erro ao carregar fluxo de caixa", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [isManager, period.start, period.end]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load, pathname]);

  useEffect(() => {
    function onFocus() {
      if (!authLoading && isManager) void load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [authLoading, isManager, load]);

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

  const resultadoPeriodo = useMemo(() => {
    if (!activeData) return 0;
    return activeData.totalEntradas - activeData.totalSaidas;
  }, [activeData]);

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
                          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">Resultado do período</CardTitle>
                          <Wallet className="h-4 w-4 text-[var(--accent-600)]" />
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{formatCurrency(resultadoPeriodo)}</p>
                          {activeTab !== "consolidado" && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              Saldo atual: {formatCurrency(activeData.saldoAtual)}
                              {contas.find((c) => c.id === activeTab)?.data_saldo_inicial && (
                                <>
                                  {" "}· referência em{" "}
                                  {new Date(`${contas.find((c) => c.id === activeTab)!.data_saldo_inicial}T12:00:00`).toLocaleDateString("pt-BR")}
                                </>
                              )}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {activeData.totalEntradas === 0 && activeData.totalSaidas === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center text-sm text-[var(--text-secondary)]">
                          Nenhuma movimentação recebida ou paga no período selecionado.
                          <br />
                          <span className="text-xs">Somente lançamentos com status recebido/pago entram no fluxo de caixa.</span>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <Card>
                          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Entradas, saídas e saldo acumulado</CardTitle>
                            <span className="text-xs text-[var(--text-secondary)]">
                              clique na legenda para alternar séries
                            </span>
                          </CardHeader>
                          <CardContent className="h-80">
                            <FinanceComposedChart
                              data={activeData.rows.map((row) => ({
                                label: row.monthLabel,
                                entradas: row.entradas,
                                saidas: row.saidas,
                                saldo: row.saldoFinal,
                              }))}
                              emptyDescription="Os lançamentos recebidos e pagos do período aparecerão aqui."
                            />
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>{detalhePorDia ? "Detalhamento diário" : "Detalhamento mensal"}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{detalhePorDia ? "Dia" : "Mês"}</TableHead>
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
                Lançamentos sem conta vinculada são atribuídos à conta principal no resumo por conta.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
