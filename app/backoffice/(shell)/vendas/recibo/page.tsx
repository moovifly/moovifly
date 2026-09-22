import type { Metadata } from "next";

import { ReciboClient } from "./recibo-client";

export const metadata: Metadata = { title: "Recibo — MooviFly" };

export default function ReciboPage() {
  return <ReciboClient />;
}
