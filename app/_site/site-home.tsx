"use client";

import { SiteNavbar } from "./site-navbar";
import { SiteHero } from "./site-hero";
import { QuemSomos } from "./quem-somos";
import { CotacaoSection } from "./cotacao-section";
import { Confessional } from "./confessional";
import { Servicos } from "./servicos";
import { Contato } from "./contato";
import { SiteFooter } from "./site-footer";

export function SiteHome() {
  return (
    <main className="bg-[#0a0a0a] text-white antialiased">
      <SiteNavbar />
      <SiteHero />
      <QuemSomos />
      <CotacaoSection />
      <Confessional />
      <Servicos />
      <Contato />
      <SiteFooter />
    </main>
  );
}
