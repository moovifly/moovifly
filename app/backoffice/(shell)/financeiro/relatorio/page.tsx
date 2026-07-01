import type { Metadata } from "next";

import { RelatorioFinanceiroClient } from "./relatorio-financeiro-client";

export const metadata: Metadata = { title: "Relatório Financeiro — MooviFly" };

export default function RelatorioFinanceiroPage() {
  return <RelatorioFinanceiroClient />;
}
