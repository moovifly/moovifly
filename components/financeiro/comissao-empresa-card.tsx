import { Landmark } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { ComissaoEmpresaResumo } from "@/lib/financial/comissao-empresa";

type ComissaoEmpresaCardProps = {
  data: ComissaoEmpresaResumo;
  loading?: boolean;
  periodLabel?: string;
};

export function ComissaoEmpresaCard({ data, loading = false, periodLabel }: ComissaoEmpresaCardProps) {
  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card className="overflow-hidden border-[var(--accent-600)]/20 bg-[var(--accent-glow)]/40">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent-glow)] text-[var(--accent-600)]">
                <Landmark className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Comissão da empresa
                </p>
                {periodLabel ? (
                  <p className="text-[11px] text-[var(--text-secondary)]">{periodLabel}</p>
                ) : null}
              </div>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {formatCurrency(data.empresa)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Média do período: {formatPercent(data.percentualEmpresa, 1)} para a empresa
              {data.liquidoAposTaxas > 0
                ? ` e ${formatPercent(100 - data.percentualEmpresa, 1)} para os vendedores`
                : ""}
              {data.vendasConsideradas > 0
                ? ` · ${data.vendasConsideradas} venda${data.vendasConsideradas === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 sm:min-w-[22rem]">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Bruta</dt>
              <dd className="text-sm font-semibold text-foreground">{formatCurrency(data.bruto)}</dd>
              <p className="text-[11px] text-[var(--text-secondary)]">RAV/DU + seguro</p>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Taxas</dt>
              <dd className="text-sm font-semibold text-[var(--danger-text)]">− {formatCurrency(data.taxas)}</dd>
              <p className="text-[11px] text-[var(--text-secondary)]">Cartão</p>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Vendedores</dt>
              <dd className="text-sm font-semibold text-[var(--danger-text)]">− {formatCurrency(data.vendedores)}</dd>
              <p className="text-[11px] text-[var(--text-secondary)]">Comissões</p>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
