import type { Metadata } from "next";
import { RelatoriosClient } from "./relatorios-client";

export const metadata: Metadata = { title: "Relatórios — MooviFly" };

export default function RelatoriosPage() {
  return <RelatoriosClient />;
}
