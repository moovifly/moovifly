import type { Metadata } from "next";
import { ClienteDetalheClient } from "./cliente-detalhe-client";

export const metadata: Metadata = { title: "Detalhes do Cliente — MooviFly" };

export default function ClienteDetalhePage() {
  return <ClienteDetalheClient />;
}
