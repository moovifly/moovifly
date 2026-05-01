"use client";

import { ArrowRight, Briefcase, MapPin, Minus, Plane, Plus, Users } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Autocomplete } from "@/components/autocomplete";
import { loadAeroportos, searchAeroportos, type Aeroporto } from "@/lib/datasets";

type TripType = "ida-volta" | "somente-ida" | "multi-destino";
type Classe = "economica" | "executiva" | "primeira";
type Bagagem = "" | "despachada" | "mao";

const TRIP_LABELS: Record<TripType, string> = {
  "ida-volta": "Ida e volta",
  "somente-ida": "Somente ida",
  "multi-destino": "Multi destino",
};

function formatBR(date: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function CotacaoSection() {
  const [aeroportos, setAeroportos] = useState<Aeroporto[]>([]);
  useEffect(() => {
    loadAeroportos().then(setAeroportos).catch(() => undefined);
  }, []);

  const [tripType, setTripType] = useState<TripType>("ida-volta");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [dataPartida, setDataPartida] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [adultos, setAdultos] = useState(1);
  const [criancas, setCriancas] = useState(0);
  const [bebes, setBebes] = useState(0);
  const [classe, setClasse] = useState<Classe>("economica");
  const [bagagem, setBagagem] = useState<Bagagem>("");
  const [voosDiretos, setVoosDiretos] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [paxOpen, setPaxOpen] = useState(false);

  const paxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paxRef.current && !paxRef.current.contains(e.target as Node)) setPaxOpen(false);
    };
    if (paxOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [paxOpen]);

  const totalPax = adultos + criancas + bebes;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!origem || !destino || !dataPartida || !nome || !telefone) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (tripType === "ida-volta" && !dataRetorno) {
      toast.error("Informe a data de retorno.");
      return;
    }

    let msg = "*Solicitação de Cotação - MooviFly*\n\n";
    msg += `*Tipo de viagem:* ${TRIP_LABELS[tripType]}\n\n`;
    msg += `*Origem:* ${origem}\n`;
    msg += `*Destino:* ${destino}\n`;
    msg += `*Data de partida:* ${formatBR(dataPartida)}\n`;
    if (tripType === "ida-volta" && dataRetorno) {
      msg += `*Data de retorno:* ${formatBR(dataRetorno)}\n`;
    }
    msg += `\n*Passageiros:*\n`;
    if (adultos > 0) msg += `  • Adultos (12+ anos): ${adultos}\n`;
    if (criancas > 0) msg += `  • Crianças (2-11 anos): ${criancas}\n`;
    if (bebes > 0) msg += `  • Bebês (0-23 meses): ${bebes}\n`;
    msg += `  • Total: ${totalPax} pessoa(s)\n\n`;
    msg += `*Classe:* ${classe.charAt(0).toUpperCase() + classe.slice(1)}\n\n`;
    if (bagagem === "despachada") msg += "*Tipo de Bagagem:* Com bagagem despachada (até 23kg)\n\n";
    if (bagagem === "mao") msg += "*Tipo de Bagagem:* Com bagagem de mão\n\n";
    if (voosDiretos) msg += "✓ Somente voos diretos\n\n";
    msg += `*Nome:* ${nome}\n`;
    msg += `*Telefone:* ${telefone}\n`;

    const url = `https://wa.me/5511934762251?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    setOrigem("");
    setDestino("");
    setDataPartida("");
    setDataRetorno("");
    setAdultos(1);
    setCriancas(0);
    setBebes(0);
    setNome("");
    setTelefone("");
  }

  return (
    <section id="cotacao" className="relative overflow-hidden bg-gradient-to-b from-[#0a0a0a] via-[#0e1a14] to-[#0a0a0a] py-20 md:py-28">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#2D5016] blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
            Cotação Online
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Solicite sua cotação
          </h2>
          <p className="mt-3 text-lg text-white/60">
            Preencha os campos abaixo e receba seu orçamento via WhatsApp.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md md:p-10"
        >
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TRIP_LABELS) as TripType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTripType(t)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  tripType === t
                    ? "border-white bg-white text-black"
                    : "border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                }`}
              >
                {TRIP_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Origem" icon={<Plane className="h-4 w-4 text-white/60" />}>
              <Autocomplete
                value={origem}
                onValueChange={setOrigem}
                onSelect={(opt) =>
                  setOrigem(`${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}`)
                }
                options={searchAeroportos(origem, aeroportos).map((a) => ({
                  value: a,
                  label: `${a.codigo} - ${a.cidade}`,
                  description: `${a.nome}, ${a.pais}`,
                }))}
                placeholder="Cidade ou aeroporto"
                dark
              />
            </FormField>
            <FormField label="Destino" icon={<MapPin className="h-4 w-4 text-white/60" />}>
              <Autocomplete
                value={destino}
                onValueChange={setDestino}
                onSelect={(opt) =>
                  setDestino(`${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}`)
                }
                options={searchAeroportos(destino, aeroportos).map((a) => ({
                  value: a,
                  label: `${a.codigo} - ${a.cidade}`,
                  description: `${a.nome}, ${a.pais}`,
                }))}
                placeholder="Cidade ou aeroporto"
                dark
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Data de partida">
              <input
                type="date"
                value={dataPartida}
                onChange={(e) => setDataPartida(e.target.value)}
                required
                className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none [color-scheme:dark]"
              />
            </FormField>
            {tripType === "ida-volta" && (
              <FormField label="Data de retorno">
                <input
                  type="date"
                  value={dataRetorno}
                  onChange={(e) => setDataRetorno(e.target.value)}
                  required
                  className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none [color-scheme:dark]"
                />
              </FormField>
            )}
            <FormField label="Passageiros e classe">
              <div ref={paxRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPaxOpen(!paxOpen)}
                  className="flex h-11 w-full items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-white/60" />
                    {totalPax} {totalPax === 1 ? "pessoa" : "pessoas"}, {classe.charAt(0).toUpperCase() + classe.slice(1)}
                  </span>
                </button>
                {paxOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 space-y-3 rounded-md border border-white/15 bg-[#1a1a1a] p-4 shadow-2xl">
                    <PaxRow label="Adultos" sub="12+ anos" value={adultos} onChange={setAdultos} min={1} />
                    <PaxRow label="Crianças" sub="2-11 anos" value={criancas} onChange={setCriancas} />
                    <PaxRow label="Bebês" sub="0-23 meses" value={bebes} onChange={setBebes} />
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <p className="text-xs font-semibold uppercase text-white/60">Classe</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["economica", "executiva", "primeira"] as Classe[]).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setClasse(c)}
                            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                              classe === c
                                ? "bg-white text-black"
                                : "bg-white/5 text-white/80 hover:bg-white/10"
                            }`}
                          >
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaxOpen(false)}
                      className="mt-2 w-full rounded-md bg-white py-2 text-xs font-semibold text-black"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Tipo de bagagem" icon={<Briefcase className="h-4 w-4 text-white/60" />}>
              <select
                value={bagagem}
                onChange={(e) => setBagagem(e.target.value as Bagagem)}
                className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                <option value="" className="bg-[#1a1a1a]">Selecione...</option>
                <option value="despachada" className="bg-[#1a1a1a]">Com bagagem despachada (23kg)</option>
                <option value="mao" className="bg-[#1a1a1a]">Com bagagem de mão</option>
              </select>
            </FormField>
            <FormField label="Preferências">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={voosDiretos}
                  onChange={(e) => setVoosDiretos(e.target.checked)}
                  className="h-4 w-4 accent-[#7FA984]"
                />
                Somente voos diretos
              </label>
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Seu nome">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Nome completo"
                className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </FormField>
            <FormField label="Telefone (WhatsApp)">
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
                placeholder="(11) 99999-9999"
                className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </FormField>
          </div>

          <button
            type="submit"
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-semibold text-black transition-colors hover:bg-white/90"
          >
            Solicitar cotação via WhatsApp
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>
      </div>
    </section>
  );
}

function FormField({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-white/70">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function PaxRow({
  label,
  sub,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/50">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="min-w-[1.5ch] text-center text-sm font-semibold">{value}</span>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
