"use client";

import { Briefcase, Building2, Globe2, Heart, Plane, Users } from "lucide-react";

const SERVICOS = [
  {
    icon: Plane,
    title: "Passagens Aéreas",
    description:
      "Encontramos as melhores tarifas em voos nacionais e internacionais com as principais companhias aéreas do mundo.",
  },
  {
    icon: Building2,
    title: "Hospedagem",
    description:
      "Hotéis, resorts e pousadas selecionados com cuidado para garantir conforto e qualidade durante sua estadia.",
  },
  {
    icon: Globe2,
    title: "Pacotes Completos",
    description:
      "Roteiros personalizados que incluem voo, hospedagem, traslados, passeios e seguro viagem em um só lugar.",
  },
  {
    icon: Briefcase,
    title: "Viagens Corporativas",
    description:
      "Soluções especializadas para empresas, com gestão completa de viagens executivas e eventos corporativos.",
  },
  {
    icon: Heart,
    title: "Lua de Mel",
    description:
      "Celebre o amor em destinos românticos. Pacotes especiais com mimos exclusivos para tornar esse momento ainda mais especial.",
  },
  {
    icon: Users,
    title: "Grupos e Excursões",
    description:
      "Viagens em grupo com toda comodidade. Perfeito para famílias, amigos ou eventos especiais com guias especializados.",
  },
];

export function Servicos() {
  return (
    <section id="servicos" className="bg-[#0a0a0a] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
            O Que Oferecemos
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Nossos Serviços
          </h2>
          <p className="mt-3 text-lg text-white/60">
            Soluções completas para todos os tipos de viagem
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#7FA984] to-[#2D5016] text-white shadow-lg">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
