import { normalizeDateOnly } from "@/lib/date-only";

export type Voo = {
  tipo: "ida" | "volta";
  origem: string;
  destino: string;
  data_partida: string;
  horario_saida: string;
  data_chegada: string;
  horario_chegada: string;
  companhia: string;
  numero_voo: string;
};

export type FlightStatusEndpoint = {
  airport: string;
  iata: string;
  city?: string | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  terminal: string | null;
  gate: string | null;
  delay: number | null;
  timezone: string | null;
};

export type FlightStatusResponse = {
  found: boolean;
  cached: boolean;
  flight_status: string | null;
  flight_status_label: string | null;
  departure: FlightStatusEndpoint;
  arrival: FlightStatusEndpoint;
  airline: { name: string; iata: string | null };
  flight: { iata: string | null; number: string | null };
  venda: {
    id: string;
    numero_venda: string;
    localizador: string | null;
    cliente_nome: string | null;
  };
  trecho: Voo | null;
  trecho_index: number;
  voos: Voo[];
  message?: string;
  fetched_at?: string;
  provider?: "aerodatabox" | "aviationstack";
};

export function emptyVoo(tipo: "ida" | "volta" = "ida"): Voo {
  return {
    tipo,
    origem: "",
    destino: "",
    data_partida: "",
    horario_saida: "",
    data_chegada: "",
    horario_chegada: "",
    companhia: "",
    numero_voo: "",
  };
}

export function migrateVoo(v: Record<string, unknown>): Voo {
  const legacyData = (v.data as string | undefined) ?? "";
  return {
    tipo: v.tipo === "volta" ? "volta" : "ida",
    origem: (v.origem as string) ?? "",
    destino: (v.destino as string) ?? "",
    data_partida: (v.data_partida as string | undefined) ?? legacyData,
    horario_saida: (v.horario_saida as string) ?? "",
    data_chegada: (v.data_chegada as string | undefined) ?? legacyData,
    horario_chegada: (v.horario_chegada as string) ?? "",
    companhia: (v.companhia as string) ?? "",
    numero_voo: (v.numero_voo as string) ?? "",
  };
}

export function parseVoosJson(raw: unknown): Voo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => migrateVoo(v as Record<string, unknown>));
}

export function voosToVendaCampos(voovs: Voo[] | undefined) {
  const idas = voovs?.filter((v) => v.tipo === "ida") ?? [];
  const voltas = voovs?.filter((v) => v.tipo === "volta") ?? [];
  const firstIda = idas[0];
  const lastIda = idas.at(-1);
  const lastVolta = voltas.at(-1);
  return {
    origem: firstIda?.origem?.trim() || null,
    destino: lastIda?.destino?.trim() || null,
    data_ida: normalizeDateOnly(firstIda?.data_partida) || null,
    data_volta: normalizeDateOnly(lastVolta?.data_partida) || normalizeDateOnly(voltas[0]?.data_partida) || null,
    companhia: firstIda?.companhia?.trim() || null,
  };
}

export function formatVoosParaObservacao(voovs: Voo[] | undefined): string {
  if (!voovs?.length) return "";
  let nIda = 0;
  let nVolta = 0;
  return voovs
    .map((v) => {
      const trecho = v.tipo === "ida" ? "Ida" : "Volta";
      const idx = v.tipo === "ida" ? ++nIda : ++nVolta;
      const parts = [
        `${trecho} #${idx}: ${v.origem?.trim() || "—"} → ${v.destino?.trim() || "—"}`,
        v.data_partida ? `Partida ${v.data_partida}` : null,
        v.data_chegada && v.data_chegada !== v.data_partida ? `Chegada ${v.data_chegada}` : null,
        [v.horario_saida, v.horario_chegada].filter(Boolean).length
          ? `Saída/chegada ${v.horario_saida || "—"} / ${v.horario_chegada || "—"}`
          : null,
        [v.companhia, v.numero_voo].filter(Boolean).join(" ").trim() || null,
      ].filter(Boolean);
      return parts.join(" | ");
    })
    .join("\n");
}

/** Extrai bloco "Detalhe dos voos:" gerado por formatVoosParaObservacao. */
export function parseVoosFromObservacoes(text: string | null | undefined): Voo[] {
  if (!text?.trim()) return [];
  const match = text.match(/Detalhe dos voos:\s*\n([\s\S]*?)(?:\n\n|$)/i);
  if (!match?.[1]) return [];

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseVooObservacaoLine)
    .filter((v): v is Voo => v !== null);
}

function parseVooObservacaoLine(line: string): Voo | null {
  const parts = line.split(" | ").map((p) => p.trim());
  const headerMatch = parts[0]?.match(/^(Ida|Volta)\s+#\d+:\s*(.+?)\s→\s*(.+)$/i);
  if (!headerMatch) return null;

  const tipo = headerMatch[1].toLowerCase() === "volta" ? "volta" : "ida";
  const origem = headerMatch[2].trim();
  const destino = headerMatch[3].trim();

  let data_partida = "";
  let data_chegada = "";
  let horario_saida = "";
  let horario_chegada = "";
  let companhia = "";
  let numero_voo = "";

  for (const part of parts.slice(1)) {
    if (part.startsWith("Partida ")) {
      data_partida = part.slice("Partida ".length).trim();
    } else if (part.startsWith("Chegada ")) {
      data_chegada = part.slice("Chegada ".length).trim();
    } else if (part.startsWith("Saída/chegada ")) {
      const times = part.slice("Saída/chegada ".length).split("/").map((t) => t.trim());
      horario_saida = times[0] === "—" ? "" : (times[0] ?? "");
      horario_chegada = times[1] === "—" ? "" : (times[1] ?? "");
    } else if (part) {
      const parsed = splitCompanhiaNumero(part);
      companhia = parsed.companhia;
      numero_voo = parsed.numero_voo;
    }
  }

  if (!data_chegada) data_chegada = data_partida;

  return {
    tipo,
    origem,
    destino,
    data_partida,
    horario_saida,
    data_chegada,
    horario_chegada,
    companhia,
    numero_voo,
  };
}

function splitCompanhiaNumero(text: string): { companhia: string; numero_voo: string } {
  const iataFlight = text.match(/^(.+?)\s+([A-Z]{2}\d+[A-Z]?)$/i);
  if (iataFlight) {
    return { companhia: iataFlight[1].trim(), numero_voo: iataFlight[2].toUpperCase() };
  }
  const numeric = text.match(/^(.+?)\s+(\d+[A-Z]?)$/i);
  if (numeric) {
    return { companhia: numeric[1].trim(), numero_voo: numeric[2] };
  }
  return { companhia: text, numero_voo: "" };
}

type CompanhiaLookup = { codigo: string; nome: string };

/** Prefixa código IATA da companhia quando numero_voo é só numérico (ex.: 524 → AT524). */
export function enrichNumeroVooIata(
  companhia: string,
  numeroVoo: string,
  companhias: CompanhiaLookup[],
): string {
  const num = numeroVoo.trim();
  if (!num) return "";
  if (/^[A-Z]{2}\d/i.test(num.replace(/\s/g, ""))) return num.replace(/\s/g, "").toUpperCase();

  const comp = companhia.trim().toLowerCase();
  if (!comp) return num;

  const found = companhias.find(
    (c) =>
      c.nome.toLowerCase() === comp ||
      c.nome.toLowerCase().includes(comp) ||
      comp.includes(c.nome.toLowerCase()),
  );
  if (!found?.codigo) return num;
  return `${found.codigo}${num}`.toUpperCase();
}

export function enrichVoosNumeros(voos: Voo[], companhias: CompanhiaLookup[]): Voo[] {
  return voos.map((v) => ({
    ...v,
    numero_voo: enrichNumeroVooIata(v.companhia, v.numero_voo, companhias) || v.numero_voo,
  }));
}

/** Monta trecho mínimo a partir dos campos planos da venda. */
export function voosFromCamposPlanos(input: {
  origem?: string | null;
  destino?: string | null;
  data_ida?: string | null;
  data_volta?: string | null;
  companhia?: string | null;
}): Voo[] {
  const voos: Voo[] = [];
  if (input.origem || input.destino || input.data_ida) {
    voos.push({
      ...emptyVoo("ida"),
      origem: input.origem?.trim() ?? "",
      destino: input.destino?.trim() ?? "",
      data_partida: input.data_ida?.slice(0, 10) ?? "",
      data_chegada: input.data_ida?.slice(0, 10) ?? "",
      companhia: input.companhia?.trim() ?? "",
    });
  }
  if (input.data_volta) {
    voos.push({
      ...emptyVoo("volta"),
      origem: input.destino?.trim() ?? "",
      destino: input.origem?.trim() ?? "",
      data_partida: input.data_volta.slice(0, 10),
      data_chegada: input.data_volta.slice(0, 10),
      companhia: input.companhia?.trim() ?? "",
    });
  }
  return voos;
}

/** Resolve voos de uma venda: JSONB → observações → campos planos. */
export function resolveVoosForVenda(input: {
  voos?: unknown;
  observacoes?: string | null;
  origem?: string | null;
  destino?: string | null;
  data_ida?: string | null;
  data_volta?: string | null;
  companhia?: string | null;
  companhiasLookup?: CompanhiaLookup[];
}): Voo[] {
  let voos = parseVoosJson(input.voos);
  if (!voos.length && input.observacoes) {
    voos = parseVoosFromObservacoes(input.observacoes);
  }
  if (!voos.length) {
    voos = voosFromCamposPlanos(input);
  }
  if (input.companhiasLookup?.length) {
    voos = enrichVoosNumeros(voos, input.companhiasLookup);
  }
  return voos;
}

/** Extrai código IATA de strings como "GRU - São Paulo" ou "GRU". */
export function extractIataCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^([A-Z]{3})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/** Normaliza número do voo para formato IATA (ex.: "LATAM LA8084" → "LA8084"). */
export function normalizeFlightIata(numeroVoo: string | null | undefined): string | null {
  if (!numeroVoo?.trim()) return null;
  const cleaned = numeroVoo.trim().replace(/\s+/g, "");
  const iataMatch = cleaned.match(/([A-Z]{2}\d{1,4}[A-Z]?)$/i);
  if (iataMatch) return iataMatch[1].toUpperCase();
  if (/^[A-Z]{2}\d/i.test(cleaned)) return cleaned.toUpperCase();
  return cleaned.toUpperCase();
}

export function getIdaVoos(voos: Voo[]): Voo[] {
  return voos.filter((v) => v.tipo === "ida");
}

export function getTrechoByIndex(voos: Voo[], index: number): Voo | null {
  const idas = getIdaVoos(voos);
  return idas[index] ?? idas[0] ?? null;
}

export function buildFlightCacheKey(flightIata: string, flightDate: string, depIata: string | null, arrIata: string | null): string {
  return [flightIata, flightDate, depIata ?? "", arrIata ?? ""].join("|");
}

const FLIGHT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  active: "No ar",
  landed: "Pousou",
  delayed: "Atrasado",
  cancelled: "Cancelado",
  incident: "Incidente",
  diverted: "Desviado",
  unknown: "Desconhecido",
};

export function flightStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return FLIGHT_STATUS_LABELS[status.toLowerCase()] ?? status;
}

export function emptyFlightEndpoint(): FlightStatusEndpoint {
  return {
    airport: "",
    iata: "",
    city: null,
    scheduled: null,
    estimated: null,
    actual: null,
    terminal: null,
    gate: null,
    delay: null,
    timezone: null,
  };
}
