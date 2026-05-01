import type { Metadata } from "next";
import { VendasClient } from "./vendas-client";

export const metadata: Metadata = { title: "Vendas — MooviFly" };

export default function VendasPage() {
  return <VendasClient />;
}
