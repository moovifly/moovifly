import type { Metadata } from "next";
import { OrcamentosClient } from "./orcamentos-client";

export const metadata: Metadata = { title: "Orçamentos — MooviFly" };

export default function OrcamentosPage() {
  return <OrcamentosClient />;
}
