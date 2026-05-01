"use client";

import { LogIn, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#quem-somos", label: "Quem Somos" },
  { href: "#cotacao", label: "Cotação" },
  { href: "#confessional", label: "Nossa Missão" },
  { href: "#servicos", label: "Serviços" },
  { href: "#contato", label: "Contato" },
];

export function SiteNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-black/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="#hero" className="flex items-center" aria-label="MooviFly">
          <Image
            src="/assets/images/moovifly_logo_branco.png"
            alt="MooviFly"
            width={140}
            height={36}
            className="h-9 w-auto"
            priority
          />
        </Link>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-2 text-white transition-colors hover:bg-white/10 md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <Link
              href="/backoffice/login/"
              aria-label="Login Backoffice"
              className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          </li>
        </ul>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-black/95 backdrop-blur-md md:hidden">
          <ul className="flex flex-col gap-1 px-4 py-4">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/backoffice/login/"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                onClick={() => setMobileOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                Backoffice
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
