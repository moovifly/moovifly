"use client";

import { Instagram } from "lucide-react";
import { useEffect, useState } from "react";

const TITLE = "viva em movimento";

export function SiteHero() {
  const [text, setText] = useState("");

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i <= TITLE.length) {
        setText(TITLE.slice(0, i));
        i++;
        timer = setTimeout(tick, 150);
      } else {
        timer = setTimeout(() => {
          i = 0;
          setText("");
          tick();
        }, 3000);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="hero"
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/HERO_SITE.png"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/50 to-black/80" />
      </div>

      <div className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <a
          href="https://www.instagram.com/moovifly"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <Instagram className="h-4 w-4" />
        </a>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-white sm:text-6xl md:text-7xl">
          <span className="block uppercase">{text}</span>
          <span className="ml-1 inline-block h-12 w-1 animate-pulse bg-white align-middle md:h-16" />
        </h1>
        <div className="mt-10 flex justify-center">
          <a
            href="#cotacao"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white px-8 py-4 text-base font-semibold text-black shadow-lg transition-all hover:bg-white/95 hover:shadow-xl"
          >
            <span>Pesquisar Preços</span>
          </a>
        </div>
      </div>
    </section>
  );
}
