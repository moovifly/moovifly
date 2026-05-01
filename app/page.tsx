import type { Metadata } from "next";
import { SiteHome } from "./_site/site-home";

export const metadata: Metadata = {
  title: "MooviFly — Viva em Movimento",
  description:
    "MooviFly é a sua agência de viagens para experiências inesquecíveis: passagens aéreas, pacotes, hospedagem, lua de mel e roteiros sob medida.",
};

export default function HomePage() {
  return <SiteHome />;
}
