"use client";

import { Instagram, Mail, Phone, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Autocomplete } from "@/components/autocomplete";
import { loadAeroportos, searchAeroportos, type Aeroporto } from "@/lib/datasets";

export function Contato() {
  const [aeroportos, setAeroportos] = useState<Aeroporto[]>([]);
  useEffect(() => {
    loadAeroportos().then(setAeroportos).catch(() => undefined);
  }, []);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [destino, setDestino] = useState("");
  const [mensagem, setMensagem] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome || !email || !telefone || !mensagem) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    let msg = "*Contato MooviFly*\n\n";
    msg += `*Nome:* ${nome}\n`;
    msg += `*Email:* ${email}\n`;
    msg += `*Telefone:* ${telefone}\n`;
    if (destino) msg += `*Destino de interesse:* ${destino}\n`;
    msg += `\n*Mensagem:*\n${mensagem}\n`;
    const url = `https://wa.me/5511934762251?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setNome("");
    setEmail("");
    setTelefone("");
    setDestino("");
    setMensagem("");
  }

  return (
    <section id="contato" className="bg-[#0a0a0a] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
            Fale Conosco
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Entre em Contato
          </h2>
          <p className="mt-3 text-lg text-white/60">
            Estamos prontos para planejar sua próxima aventura
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-8">
            <div>
              <h3 className="font-display text-2xl font-semibold text-white">Vamos conversar?</h3>
              <p className="mt-3 text-white/70">
                Nossa equipe está pronta para atender você e criar a viagem dos seus sonhos.
                Entre em contato pelos canais abaixo ou preencha o formulário.
              </p>
            </div>

            <div className="space-y-4">
              <ContactItem
                icon={<Phone className="h-5 w-5" />}
                title="Telefone"
                text="(11) 93476-2251"
                href="tel:+5511934762251"
              />
              <ContactItem
                icon={<Mail className="h-5 w-5" />}
                title="Email"
                text="contato@moovifly.com.br"
                href="mailto:contato@moovifly.com.br"
              />
            </div>

            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/moovifly"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5511934762251"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Send className="h-4 w-4" />
              </a>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telefone">
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                  className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                />
              </Field>
              <Field label="Destino de interesse">
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
              </Field>
            </div>
            <Field label="Mensagem">
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                required
                rows={5}
                className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </Field>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-semibold text-black transition-colors hover:bg-white/90"
            >
              <Send className="h-4 w-4" />
              Enviar via WhatsApp
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-white/70">{label}</label>
      {children}
    </div>
  );
}

function ContactItem({
  icon,
  title,
  text,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#7FA984] to-[#2D5016] text-white">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{title}</p>
        <p className="text-base font-medium text-white">{text}</p>
      </div>
    </a>
  );
}
