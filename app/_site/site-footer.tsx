"use client";

import Image from "next/image";

const FOOTER_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#quem-somos", label: "Quem Somos" },
  { href: "#cotacao", label: "Cotação" },
  { href: "#confessional", label: "Nossa Missão" },
  { href: "#servicos", label: "Serviços" },
  { href: "#contato", label: "Contato" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Image
              src="/assets/images/moovifly_logo_branco.png"
              alt="MooviFly"
              width={140}
              height={36}
              className="h-9 w-auto"
            />
            <p className="mt-4 text-sm text-white/60">Viva em movimento com a MooviFly.</p>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/80">
              Links Rápidos
            </h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/80">
              Contato
            </h4>
            <p className="text-sm text-white/60">contato@moovifly.com.br</p>
            <p className="mt-1 text-sm text-white/60">(11) 93476-2251</p>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} MooviFly. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
