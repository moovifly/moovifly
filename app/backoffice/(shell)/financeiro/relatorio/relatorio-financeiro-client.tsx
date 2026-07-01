"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { FinancePeriodFilter } from "@/components/financeiro/finance-period-filter";
import { FinanceiroNav } from "@/components/financeiro/financeiro-nav";
import { FinanceDonut, ReceitasDespesasLineChart } from "@/components/financeiro/relatorio-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  aggregateRelatorioFinanceiro,
  periodSubtitleLabel,
  type DespesaRow,
  type ReceitaRow,
  type RelatorioFinanceiroData,
} from "@/lib/financial/relatorio";
import { defaultFinancePeriod } from "@/lib/financial/period";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";

const EMPTY: RelatorioFinanceiroData = {
  receitaTotal: 0,
  despesasTotal: 0,
  resultadoLiquido: 0,
  margem: 0,
  mensal: [],
  chartMensal: [],
  porFormaPagamento: [],
  porCategoria: [],
};

export function RelatorioFinanceiroClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [period, setPeriod] = useState(defaultFinancePeriod);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RelatorioFinanceiroData>(EMPTY);

  const isManager = profile && ["administrador", "gerente"].includes(profile.tipo);
  const periodLabel = periodSubtitleLabel(period.preset || "mes");

  async function load() {
    if (!isManager) return;
    setLoading(true);
    try {
      const [{ data: receitas }, { data: despesas }] = await Promise.all([
        supabase
          .from("contas_receber")
          .select("valor, data_recebimento, forma_pagamento")
          .eq("status", "recebida")
          .gte("data_recebimento", period.start)
          .lte("data_recebimento", period.end),
        supabase
          .from("contas_pagar")
          .select("valor, data_pagamento, categoria")
          .eq("status", "paga")
          .gte("data_pagamento", period.start)
          .lte("data_pagamento", period.end),
      ]);

      setData(
        aggregateRelatorioFinanceiro(
          (receitas ?? []) as ReceitaRow[],
          (despesas ?? []) as DespesaRow[],
          period.start,
          period.end,
        ),
      );
    } catch (err) {
      toast.error("Erro ao carregar relatório", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, period.start, period.end]);

  if (!isManager) {
    return (
      <>
        <Topbar title="Financeiro" />
        <div className="p-6 text-sm text-[var(--text-secondary)]">Acesso restrito a administradores e gerentes.</div>
      </>
    );
  }

  const resultadoColor =
    data.resultadoLiquido > 0
      ? "text-[#2563EB]"
      : data.resultadoLiquido < 0
        ? "text-[#DC2626]"
        : "text-foreground";

  return (
    <>
      <Topbar title="Financeiro" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <FinanceiroNav />

        <div>
          <h2 className="text-lg font-semibold text-foreground">Relatório Financeiro</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Visão geral do desempenho financeiro — {periodLabel}
          </p>
        </div>

        <FinancePeriodFilter period={period} onChange={setPeriod} />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                    Receita Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(data.receitaTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                    Despesas Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-[#DC2626]">{formatCurrency(data.despesasTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                    Resultado Líquido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${resultadoColor}`}>
                    {formatCurrency(data.resultadoLiquido)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                    Margem
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-[#D97706]">{formatPercent(data.margem, 1)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Caixa — Receitas vs Despesas</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {data.chartMensal.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
                    Sem movimentação no período.
                  </div>
                ) : (
                  <ReceitasDespesasLineChart data={data.chartMensal} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Receita por forma de pagamento</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  <FinanceDonut data={data.porFormaPagamento} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Despesas por categoria</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  <FinanceDonut data={data.porCategoria} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resumo mensal</CardTitle>
              </CardHeader>
              <CardContent>
                {data.mensal.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Sem dados no período.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead>Receita</TableHead>
                        <TableHead>Despesas</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Margem %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.mensal.map((row) => (
                        <TableRow key={row.monthKey}>
                          <TableCell className="font-medium">{row.monthLabel}</TableCell>
                          <TableCell className="text-[#16A34A]">{formatCurrency(row.receita)}</TableCell>
                          <TableCell className="text-[#DC2626]">{formatCurrency(row.despesas)}</TableCell>
                          <TableCell
                            className={
                              row.resultado > 0
                                ? "text-[#2563EB] font-semibold"
                                : row.resultado < 0
                                  ? "text-[#DC2626] font-semibold"
                                  : "font-semibold"
                            }
                          >
                            {formatCurrency(row.resultado)}
                          </TableCell>
                          <TableCell className="text-[#D97706]">{formatPercent(row.margem, 1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
