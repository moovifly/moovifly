import type { Metadata } from "next";

import { ComissoesClient } from "./comissoes-client";

export const metadata: Metadata = { title: "Comissões — MooviFly" };

export default function ComissoesPage() {
  return <ComissoesClient />;
}
