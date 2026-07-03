"use client";

import { Plus, X } from "lucide-react";

import { Autocomplete } from "@/components/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Aeroporto, Companhia } from "@/lib/datasets";
import { searchAeroportos, searchCompanhias } from "@/lib/datasets";
import { emptyVoo, type Voo } from "@/lib/voos";

type VoosFormSectionProps = {
  voos: Voo[];
  onChange: (voos: Voo[]) => void;
  aeroportos: Aeroporto[];
  companhias: Companhia[];
  disabled?: boolean;
  onCompanhiaSelect?: (index: number, companhia: Companhia) => void;
};

export function VoosFormSection({
  voos,
  onChange,
  aeroportos,
  companhias,
  disabled = false,
  onCompanhiaSelect,
}: VoosFormSectionProps) {
  function addVoo(tipo: "ida" | "volta") {
    onChange([...voos, emptyVoo(tipo)]);
  }

  function removeVoo(i: number) {
    onChange(voos.filter((_, idx) => idx !== i));
  }

  function updateVoo(i: number, patch: Partial<Voo>) {
    onChange(voos.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-md border border-[var(--border-subtle)] p-4 disabled:opacity-70">
      <legend className="px-2 text-sm font-semibold text-foreground">Voos</legend>
      {(["ida", "volta"] as const).map((tipo) => {
        const voosDoTipo = voos.map((v, i) => ({ v, i })).filter((x) => x.v.tipo === tipo);
        return (
          <div key={tipo} className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Voos de {tipo.toUpperCase()}</p>
            {voosDoTipo.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)]">Nenhum voo adicionado.</p>
            )}
            {voosDoTipo.map(({ v, i }) => (
              <div
                key={i}
                className="space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Voo #{i + 1}</span>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVoo(i)}
                      className="text-[var(--danger-text)]"
                    >
                      <X className="h-3 w-3" /> Remover
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Origem</Label>
                    <Autocomplete
                      value={v.origem}
                      onValueChange={(t) => updateVoo(i, { origem: t })}
                      onSelect={(opt) =>
                        updateVoo(i, {
                          origem: `${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}`,
                        })
                      }
                      options={searchAeroportos(v.origem, aeroportos).map((a) => ({
                        value: a,
                        label: `${a.codigo} - ${a.cidade}`,
                        description: `${a.nome}, ${a.pais}`,
                      }))}
                      placeholder="Aeroporto de origem"
                    />
                  </div>
                  <div>
                    <Label>Destino</Label>
                    <Autocomplete
                      value={v.destino}
                      onValueChange={(t) => updateVoo(i, { destino: t })}
                      onSelect={(opt) =>
                        updateVoo(i, {
                          destino: `${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}`,
                        })
                      }
                      options={searchAeroportos(v.destino, aeroportos).map((a) => ({
                        value: a,
                        label: `${a.codigo} - ${a.cidade}`,
                        description: `${a.nome}, ${a.pais}`,
                      }))}
                      placeholder="Aeroporto de destino"
                    />
                  </div>
                  <div>
                    <Label>Data de Partida</Label>
                    <Input
                      type="date"
                      value={v.data_partida}
                      onChange={(e) => updateVoo(i, { data_partida: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Horário de Partida</Label>
                    <Input
                      type="time"
                      value={v.horario_saida}
                      onChange={(e) => updateVoo(i, { horario_saida: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data de Chegada</Label>
                    <Input
                      type="date"
                      value={v.data_chegada}
                      onChange={(e) => updateVoo(i, { data_chegada: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Horário de Chegada</Label>
                    <Input
                      type="time"
                      value={v.horario_chegada}
                      onChange={(e) => updateVoo(i, { horario_chegada: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Companhia</Label>
                    <Autocomplete
                      value={v.companhia}
                      onValueChange={(t) => updateVoo(i, { companhia: t })}
                      onSelect={(opt) => {
                        const c = opt.value as Companhia;
                        if (onCompanhiaSelect) {
                          onCompanhiaSelect(i, c);
                        } else {
                          updateVoo(i, { companhia: c.nome });
                        }
                      }}
                      options={searchCompanhias(v.companhia, companhias).map((c) => ({
                        value: c,
                        label: c.nome,
                        description: `${c.codigo} · ${c.pais}`,
                      }))}
                      placeholder="LATAM, GOL, Azul..."
                    />
                  </div>
                  <div>
                    <Label>Número do voo</Label>
                    <Input
                      value={v.numero_voo}
                      onChange={(e) => updateVoo(i, { numero_voo: e.target.value })}
                      placeholder="LA1234"
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>
            ))}
            {!disabled && (
              <Button type="button" variant="outline" size="sm" onClick={() => addVoo(tipo)}>
                <Plus className="h-4 w-4" /> Adicionar voo de {tipo.toUpperCase()}
              </Button>
            )}
            {tipo === "ida" && <div className="h-px w-full bg-[var(--border-subtle)]" />}
          </div>
        );
      })}
    </fieldset>
  );
}
