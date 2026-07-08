"use client";

import { Instagram } from "lucide-react";
import { useEffect, useState } from "react";

const TITLE = "viva em movimento";
const TYPE_MS = 85;
const TYPE_JITTER_MS = 70;
const DELETE_MS = 40;
const HOLD_FULL_MS = 2800;
const HOLD_EMPTY_MS = 600;

export function SiteHero() {
  const [text, setText] = useState("");
  const [idle, setIdle] = useState(true);

  useEffect(() => {
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      i += deleting ? -1 : 1;
      setText(TITLE.slice(0, i));

      if (!deleting && i === TITLE.length) {
        deleting = true;
        setIdle(true);
        timer = setTimeout(() => {
          setIdle(false);
          tick();
        }, HOLD_FULL_MS);
      } else if (deleting && i === 0) {
        deleting = false;
        setIdle(true);
        timer = setTimeout(() => {
          setIdle(false);
          tick();
        }, HOLD_EMPTY_MS);
      } else {
        timer = setTimeout(
          tick,
          deleting ? DELETE_MS : TYPE_MS + Math.random() * TYPE_JITTER_MS,
        );
      }
    };

    timer = setTimeout(() => {
      setIdle(false);
      tick();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="hero"
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Duas cópias da tira espelhada lado a lado: quando o ciclo reinicia,
            a segunda cópia ocupa a posição exata da primeira — loop sem costura */}
        <div className="absolute left-0 top-1/2 flex h-[140%] w-max animate-hero-clouds">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/images/hero-clouds-loop.webp"
            alt=""
            className="h-full w-auto max-w-none"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/images/hero-clouds-loop.webp"
            alt=""
            className="h-full w-auto max-w-none"
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/hero-wing.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/hero-frame.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
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
        <h1
          aria-label={TITLE}
          className="grid font-display text-5xl font-bold uppercase tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          {/* Placeholder invisível: reserva a altura final e evita pulos de layout */}
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">
            {TITLE}
          </span>
          <span aria-hidden="true" className="col-start-1 row-start-1">
            {text}
            <span
              className={`ml-[0.1em] inline-block h-[0.78em] w-[3px] rounded-full bg-white align-baseline md:w-1 ${
                idle ? "animate-hero-caret-blink" : ""
              }`}
            />
          </span>
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
