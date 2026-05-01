import type { Metadata } from "next";
import { ConfiguracoesClient } from "./configuracoes-client";

export const metadata: Metadata = { title: "Configurações — MooviFly" };

export default function ConfiguracoesPage() {
  return <ConfiguracoesClient />;
}
