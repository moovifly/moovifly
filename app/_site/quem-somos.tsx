"use client";

export function QuemSomos() {
  return (
    <section id="quem-somos" className="bg-[#0a0a0a] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
            Sobre Nós
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Quem Somos
          </h2>
          <p className="mt-3 text-lg text-white/60">
            Transformando sonhos em experiências reais
          </p>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-4 text-white/85">
            <p className="text-xl font-medium leading-relaxed">
              A <strong className="text-white">MooviFly</strong> nasceu da paixão por conectar
              pessoas a experiências únicas ao redor do mundo.
            </p>
            <p className="leading-relaxed text-white/70">
              Com anos de experiência no mercado de turismo, nossa equipe especializada está pronta
              para transformar suas expectativas em realidade. Acreditamos que cada viagem é uma
              oportunidade de crescimento, descoberta e conexão.
            </p>
            <p className="leading-relaxed text-white/70">
              Nosso compromisso é oferecer não apenas pacotes de viagem, mas experiências
              memoráveis personalizadas para cada cliente, cuidando de cada detalhe da sua jornada.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80"
              alt="Equipe MooviFly"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
