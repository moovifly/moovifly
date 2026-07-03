import { readFileSync } from "fs";
import { join } from "path";

type CompanhiaRow = { codigo: string; nome: string };

let cache: CompanhiaRow[] | null = null;

export function loadCompanhiasServer(): CompanhiaRow[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(
      readFileSync(join(process.cwd(), "public/data/companhias-aereas.json"), "utf8"),
    ) as CompanhiaRow[];
  } catch {
    cache = [];
  }
  return cache;
}
