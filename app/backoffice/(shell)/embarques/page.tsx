import type { Metadata } from "next";
import { EmbarquesClient } from "./embarques-client";

export const metadata: Metadata = { title: "Embarques — MooviFly" };

export default function EmbarquesPage() {
  return <EmbarquesClient />;
}

