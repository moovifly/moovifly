import type { Metadata } from "next";

import { FluxoCaixaClient } from "./fluxo-caixa-client";

export const metadata: Metadata = { title: "Fluxo de Caixa — MooviFly" };

export default function FluxoCaixaPage() {
  return <FluxoCaixaClient />;
}
