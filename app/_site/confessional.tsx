"use client";

const PHRASES = [
  "Acreditamos que cada destino tem uma história para contar.",
  "Que cada viagem transforma, conecta e inspira.",
  "Que o mundo é grande demais para ficar em um só lugar.",
  "Por isso, nossa missão é criar experiências que vão além do roteiro.",
  "MooviFly: viva em movimento, descubra sem limites.",
];

export function Confessional() {
  return (
    <section
      id="confessional"
      className="relative overflow-hidden bg-[#0a0a0a] py-24 md:py-32"
    >
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -right-32 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#7FA984] blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl space-y-5 px-4 text-center sm:max-w-6xl md:px-8 lg:max-w-7xl">
        <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          Nossa Missão
        </span>
        <div className="space-y-4">
          {PHRASES.map((p, i) => (
            <p
              key={i}
              className={`text-balance font-display text-xl leading-relaxed tracking-tight sm:text-2xl md:text-3xl ${
                i === PHRASES.length - 1
                  ? "font-bold text-white"
                  : "text-white/80"
              }`}
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
