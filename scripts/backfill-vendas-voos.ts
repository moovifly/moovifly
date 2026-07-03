/**
 * Backfill one-off: popula vendas.voos a partir de orçamentos, observações ou campos planos.
 * Uso: npx tsx scripts/backfill-vendas-voos.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

import { createClient } from "@supabase/supabase-js";

import {
  enrichVoosNumeros,
  parseVoosFromObservacoes,
  parseVoosJson,
  voosFromCamposPlanos,
  type Voo,
} from "../lib/voos";

function loadEnv() {
  try {
    const envPath = join(process.cwd(), ".env.local");
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env.local opcional se vars já estiverem no ambiente */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const companhias = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/companhias-aereas.json"), "utf8"),
) as { codigo: string; nome: string }[];

type VendaRow = {
  id: string;
  numero_venda: string;
  orcamento_id: string | null;
  observacoes: string | null;
  origem: string | null;
  destino: string | null;
  data_ida: string | null;
  data_volta: string | null;
  companhia: string | null;
  voos: unknown;
  orcamentos?: { voos: unknown } | { voos: unknown }[] | null;
};

async function main() {
  const { data: vendas, error } = await supabase
    .from("vendas")
    .select("id, numero_venda, orcamento_id, observacoes, origem, destino, data_ida, data_volta, companhia, voos, orcamentos(voos)")
    .or("categoria_venda.eq.aereo,categoria_venda.is.null");

  if (error) throw error;

  let updated = 0;
  let skipped = 0;
  const sources: Record<string, number> = { orcamento: 0, observacoes: 0, campos: 0, ja_preenchido: 0 };

  for (const v of (vendas ?? []) as VendaRow[]) {
    const existing = parseVoosJson(v.voos);
    if (existing.some((f) => f.numero_voo?.trim())) {
      sources.ja_preenchido++;
      skipped++;
      continue;
    }

    let voos: Voo[] = [];
    let source = "campos";

    const orcRel = v.orcamentos;
    const orcVoosRaw = Array.isArray(orcRel) ? orcRel[0]?.voos : orcRel?.voos;
    const orcVoos = parseVoosJson(orcVoosRaw);
    if (orcVoos.length) {
      voos = orcVoos;
      source = "orcamento";
    } else {
      const fromObs = parseVoosFromObservacoes(v.observacoes);
      if (fromObs.length) {
        voos = fromObs;
        source = "observacoes";
      } else {
        voos = voosFromCamposPlanos(v);
        source = "campos";
      }
    }

    voos = enrichVoosNumeros(voos, companhias);
    if (!voos.length) {
      skipped++;
      continue;
    }

    const { error: upErr } = await supabase.from("vendas").update({ voos }).eq("id", v.id);
    if (upErr) {
      console.error(`Erro ${v.numero_venda}:`, upErr.message);
      continue;
    }

    sources[source]++;
    updated++;
    console.log(`${v.numero_venda}: ${voos.length} trecho(s) via ${source} (ex.: ${voos[0]?.numero_voo || "sem nº"})`);
  }

  console.log("\nResumo:", { updated, skipped, sources });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
