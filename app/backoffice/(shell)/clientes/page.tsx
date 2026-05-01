import type { Metadata } from "next";
import { ClientesClient } from "./clientes-client";

export const metadata: Metadata = { title: "Clientes — MooviFly" };

export default function ClientesPage() {
  return <ClientesClient />;
}
