import type { AviationstackFlight } from "@/lib/aviationstack";

/**
 * AeroDataBox (via RapidAPI) — consulta status por número de voo + data,
 * incluindo datas futuras (agenda) e históricas, ao contrário do plano
 * free da Aviationstack (só tempo real).
 */
const API_HOST = "aerodatabox.p.rapidapi.com";

type AeroDataBoxTime = { utc?: string; local?: string };

type AeroDataBoxAirport = {
  iata?: string;
  icao?: string;
  name?: string;
  shortName?: string;
  municipalityName?: string;
  timeZone?: string;
};

type AeroDataBoxEndpoint = {
  airport?: AeroDataBoxAirport;
  scheduledTime?: AeroDataBoxTime;
  revisedTime?: AeroDataBoxTime;
  predictedTime?: AeroDataBoxTime;
  runwayTime?: AeroDataBoxTime;
  terminal?: string;
  gate?: string;
};

export type AeroDataBoxFlight = {
  number?: string;
  status?: string;
  codeshareStatus?: string;
  departure?: AeroDataBoxEndpoint;
  arrival?: AeroDataBoxEndpoint;
  airline?: { name?: string; iata?: string; icao?: string };
  aircraft?: { model?: string };
  lastUpdatedUtc?: string;
};

/** Status AeroDataBox → vocabulário Aviationstack já usado no app (badges/labels). */
const STATUS_MAP: Record<string, string> = {
  expected: "scheduled",
  checkin: "scheduled",
  boarding: "scheduled",
  gateclosed: "scheduled",
  departed: "active",
  enroute: "active",
  approaching: "active",
  arrived: "landed",
  delayed: "delayed",
  canceled: "cancelled",
  canceleduncertain: "cancelled",
  diverted: "diverted",
};

export function hasAeroDataBoxKey(): boolean {
  return Boolean(process.env.AERODATABOX_API_KEY?.trim());
}

/** AeroDataBox usa "YYYY-MM-DD HH:mm" — normaliza para ISO parseável no client. */
function toIso(time: AeroDataBoxTime | undefined): string | null {
  const value = time?.local ?? time?.utc;
  if (!value) return null;
  return value.replace(" ", "T");
}

function parseUtc(time: AeroDataBoxTime | undefined): number | null {
  if (!time?.utc) return null;
  const parsed = Date.parse(time.utc.replace(" ", "T"));
  return Number.isNaN(parsed) ? null : parsed;
}

function delayMinutes(endpoint: AeroDataBoxEndpoint | undefined): number | null {
  const scheduled = parseUtc(endpoint?.scheduledTime);
  const revised = parseUtc(endpoint?.revisedTime);
  if (scheduled == null || revised == null) return null;
  const minutes = Math.round((revised - scheduled) / 60000);
  return minutes > 0 ? minutes : null;
}

function mapEndpoint(raw: AeroDataBoxEndpoint | undefined) {
  return {
    airport: raw?.airport?.name ?? raw?.airport?.shortName ?? "",
    iata: raw?.airport?.iata ?? "",
    city: raw?.airport?.municipalityName ?? null,
    timezone: raw?.airport?.timeZone,
    terminal: raw?.terminal ?? null,
    gate: raw?.gate ?? null,
    scheduled: toIso(raw?.scheduledTime),
    estimated: toIso(raw?.revisedTime) ?? toIso(raw?.predictedTime),
    actual: toIso(raw?.runwayTime),
    delay: delayMinutes(raw),
  };
}

function splitFlightNumber(raw: string | undefined): { iata: string | null; number: string | null } {
  const cleaned = raw?.replace(/\s+/g, "").toUpperCase() ?? "";
  const match = cleaned.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  if (!match) return { iata: cleaned || null, number: null };
  return { iata: cleaned, number: match[2] };
}

function mapToNormalizedFlight(item: AeroDataBoxFlight, flightDate: string): AviationstackFlight {
  const rawStatus = item.status?.toLowerCase().replace(/\s/g, "") ?? "";
  const flight = splitFlightNumber(item.number);
  return {
    flight_date: flightDate,
    flight_status: STATUS_MAP[rawStatus] ?? (rawStatus || undefined),
    departure: mapEndpoint(item.departure),
    arrival: mapEndpoint(item.arrival),
    airline: { name: item.airline?.name, iata: item.airline?.iata },
    flight: { number: flight.number ?? undefined, iata: flight.iata ?? undefined },
  };
}

/** Um número de voo pode ter mais de um trecho no dia — prioriza o que casa com a rota. */
export function pickAeroDataBoxFlight(
  results: AeroDataBoxFlight[],
  input: { depIata: string | null; arrIata: string | null },
): AeroDataBoxFlight | null {
  if (!results.length) return null;
  const dep = input.depIata?.toUpperCase();
  const arr = input.arrIata?.toUpperCase();

  const byRoute = results.filter(
    (r) =>
      (!dep || r.departure?.airport?.iata?.toUpperCase() === dep) &&
      (!arr || r.arrival?.airport?.iata?.toUpperCase() === arr),
  );
  const candidates = byRoute.length ? byRoute : results;
  return candidates.find((r) => r.codeshareStatus !== "IsCodeshared") ?? candidates[0] ?? null;
}

export async function fetchFlightStatusFromAeroDataBox(input: {
  flightIata: string;
  flightDate: string;
  depIata: string | null;
  arrIata: string | null;
}): Promise<AviationstackFlight | null> {
  const apiKey = process.env.AERODATABOX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AERODATABOX_API_KEY não configurada.");
  }
  if (!input.flightIata || !input.flightDate) return null;

  const url =
    `https://${API_HOST}/flights/number/${encodeURIComponent(input.flightIata)}/${input.flightDate}` +
    "?withAircraftImage=false&withLocation=false&dateLocalRole=Both";

  const res = await fetch(url, {
    headers: { "x-rapidapi-host": API_HOST, "x-rapidapi-key": apiKey },
    next: { revalidate: 0 },
  });

  // 204/404: nenhum voo com esse número nessa data
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AeroDataBox HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as AeroDataBoxFlight[];
  const match = pickAeroDataBoxFlight(Array.isArray(json) ? json : [], input);
  return match ? mapToNormalizedFlight(match, input.flightDate) : null;
}

export function aeroDataBoxNotFoundMessage(flightDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (flightDate > today) {
    return (
      "Voo não encontrado na agenda desta data. Confira o número do voo na venda — " +
      "ou a companhia ainda não publicou a programação para este dia."
    );
  }
  if (flightDate < today) {
    return "Voo não encontrado no histórico desta data. Confira o número do voo cadastrado na venda.";
  }
  return "Voo não encontrado para hoje. Confira o número do voo cadastrado na venda.";
}
