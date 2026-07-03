import {
  emptyFlightEndpoint,
  flightStatusLabel,
  type FlightStatusEndpoint,
  type FlightStatusResponse,
  type Voo,
} from "@/lib/voos";

/** Plano free: sem query params além de access_key/limit (flight_date exige plano pago). */
const API_BASE = "https://api.aviationstack.com/v1/flights";
const FREE_PLAN_MAX_LIMIT = 100;

type AviationstackAirport = {
  airport?: string;
  city?: string | null;
  timezone?: string;
  iata?: string;
  terminal?: string | null;
  gate?: string | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
  delay?: number | null;
};

export type AviationstackFlight = {
  flight_date?: string;
  flight_status?: string;
  departure?: AviationstackAirport;
  arrival?: AviationstackAirport;
  airline?: { name?: string; iata?: string };
  flight?: { number?: string; iata?: string; icao?: string };
};

type AviationstackResponse = {
  data?: AviationstackFlight[];
  error?: { code?: string; message?: string };
};

export class AviationstackPlanError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function mapEndpoint(raw: AviationstackAirport | undefined): FlightStatusEndpoint {
  if (!raw) return emptyFlightEndpoint();
  return {
    airport: raw.airport ?? "",
    iata: raw.iata ?? "",
    city: raw.city ?? null,
    scheduled: raw.scheduled ?? null,
    estimated: raw.estimated ?? null,
    actual: raw.actual ?? null,
    terminal: raw.terminal ?? null,
    gate: raw.gate ?? null,
    delay: raw.delay ?? null,
    timezone: raw.timezone ?? null,
  };
}

function mapFlightResult(
  item: AviationstackFlight,
  meta: {
    venda: FlightStatusResponse["venda"];
    trecho: Voo | null;
    trecho_index: number;
    voos: Voo[];
    cached: boolean;
  },
): FlightStatusResponse {
  const status = item.flight_status ?? null;
  return {
    found: true,
    cached: meta.cached,
    fetched_at: new Date().toISOString(),
    flight_status: status,
    flight_status_label: flightStatusLabel(status),
    departure: mapEndpoint(item.departure),
    arrival: mapEndpoint(item.arrival),
    airline: {
      name: item.airline?.name ?? "",
      iata: item.airline?.iata ?? null,
    },
    flight: {
      iata: item.flight?.iata ?? null,
      number: item.flight?.number ?? null,
    },
    venda: meta.venda,
    trecho: meta.trecho,
    trecho_index: meta.trecho_index,
    voos: meta.voos,
  };
}

function notFoundResponse(
  meta: {
    venda: FlightStatusResponse["venda"];
    trecho: Voo | null;
    trecho_index: number;
    voos: Voo[];
    cached: boolean;
    message: string;
  },
): FlightStatusResponse {
  return {
    found: false,
    cached: meta.cached,
    fetched_at: new Date().toISOString(),
    flight_status: null,
    flight_status_label: null,
    departure: emptyFlightEndpoint(),
    arrival: emptyFlightEndpoint(),
    airline: { name: "", iata: null },
    flight: { iata: null, number: null },
    venda: meta.venda,
    trecho: meta.trecho,
    trecho_index: meta.trecho_index,
    voos: meta.voos,
    message: meta.message,
  };
}

async function callAviationstack(params: Record<string, string>): Promise<AviationstackFlight[]> {
  const accessKey = process.env.AVIATIONSTACK_ACCESS_KEY?.trim();
  if (!accessKey) {
    throw new Error("AVIATIONSTACK_ACCESS_KEY não configurada.");
  }

  const url = new URL(API_BASE);
  url.searchParams.set("access_key", accessKey);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const json = (await res.json()) as AviationstackResponse;

  if (!res.ok || json.error) {
    const code = json.error?.code ?? "unknown";
    const msg = json.error?.message ?? `Aviationstack HTTP ${res.status}`;
    throw new AviationstackPlanError(code, msg);
  }

  return json.data ?? [];
}

function isRestrictedPlanError(e: unknown): boolean {
  return e instanceof AviationstackPlanError && e.code === "function_access_restricted";
}

function flightMatchesDate(item: AviationstackFlight, flightDate: string): boolean {
  if (!flightDate) return true;
  if (item.flight_date?.startsWith(flightDate)) return true;
  const dep = item.departure?.scheduled?.slice(0, 10);
  return dep === flightDate;
}

/** Filtra voos em memória (necessário no plano gratuito). */
export function findMatchingFlight(
  results: AviationstackFlight[],
  input: {
    flightIata: string;
    flightDate: string;
    depIata: string | null;
    arrIata: string | null;
    strictDate?: boolean;
  },
): AviationstackFlight | null {
  if (!results.length) return null;

  const flightIata = input.flightIata?.toUpperCase();
  const dep = input.depIata?.toUpperCase();
  const arr = input.arrIata?.toUpperCase();

  const byDate = input.strictDate
    ? results.filter((r) => flightMatchesDate(r, input.flightDate))
    : results;

  if (flightIata) {
    const exact = byDate.find((r) => r.flight?.iata?.toUpperCase() === flightIata);
    if (exact) return exact;
    const byNumber = byDate.find((r) => {
      const iata = r.flight?.iata?.toUpperCase() ?? "";
      return iata.endsWith(flightIata.replace(/^[A-Z]{2}/, "")) || iata === flightIata;
    });
    if (byNumber) return byNumber;
  }

  if (dep && arr) {
    const routeMatches = byDate.filter(
      (r) =>
        r.departure?.iata?.toUpperCase() === dep &&
        r.arrival?.iata?.toUpperCase() === arr,
    );
    if (routeMatches.length === 1) return routeMatches[0] ?? null;
    if (routeMatches.length > 1 && flightIata) {
      return routeMatches.find((r) => r.flight?.iata?.toUpperCase() === flightIata) ?? routeMatches[0] ?? null;
    }
    return routeMatches[0] ?? null;
  }

  return null;
}

function freePlanNotFoundMessage(flightDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (flightDate > today) {
    return (
      "Plano gratuito da Aviationstack só rastreia voos em tempo real (hoje). " +
      "Este embarque é em data futura — consulte novamente no dia do voo ou faça upgrade do plano."
    );
  }
  if (flightDate < today) {
    return (
      "Plano gratuito não consulta voos passados. Para histórico, upgrade do plano Aviationstack (Basic+)."
    );
  }
  return "Voo não encontrado nos voos em tempo real de hoje. Confira o número do voo ou tente no horário do embarque.";
}

async function fetchWithPaidParams(input: {
  flightIata: string;
  flightDate: string;
  depIata: string | null;
  arrIata: string | null;
}): Promise<AviationstackFlight | null> {
  if (input.flightIata) {
    const results = await callAviationstack({
      flight_iata: input.flightIata,
      flight_date: input.flightDate,
      limit: "1",
    });
    if (results.length) return results[0] ?? null;
  }

  if (input.depIata && input.arrIata) {
    const results = await callAviationstack({
      dep_iata: input.depIata,
      arr_iata: input.arrIata,
      flight_date: input.flightDate,
      limit: "5",
    });
    return findMatchingFlight(results, { ...input, strictDate: false }) ?? results[0] ?? null;
  }

  return null;
}

async function fetchWithFreePlan(input: {
  flightIata: string;
  flightDate: string;
  depIata: string | null;
  arrIata: string | null;
}): Promise<AviationstackFlight | null> {
  const results = await callAviationstack({ limit: String(FREE_PLAN_MAX_LIMIT) });
  const today = new Date().toISOString().slice(0, 10);
  const isToday = input.flightDate === today;

  const match = findMatchingFlight(results, {
    ...input,
    strictDate: isToday,
  });

  return match;
}

export async function fetchFlightStatusFromApi(input: {
  flightIata: string;
  flightDate: string;
  depIata: string | null;
  arrIata: string | null;
}): Promise<AviationstackFlight | null> {
  const useFreeOnly = process.env.AVIATIONSTACK_PLAN?.trim().toLowerCase() === "free";

  if (!useFreeOnly) {
    try {
      const paid = await fetchWithPaidParams(input);
      if (paid) return paid;
    } catch (e) {
      if (!isRestrictedPlanError(e)) throw e;
    }
  }

  return fetchWithFreePlan(input);
}

export function freePlanNotFoundReason(flightDate: string): string {
  return freePlanNotFoundMessage(flightDate);
}

export function mapCachedPayload(payload: unknown): FlightStatusResponse | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as FlightStatusResponse;
}

export function buildFlightStatusResponse(
  item: AviationstackFlight | null,
  meta: {
    venda: FlightStatusResponse["venda"];
    trecho: Voo | null;
    trecho_index: number;
    voos: Voo[];
    cached: boolean;
    notFoundMessage?: string;
  },
): FlightStatusResponse {
  if (!item) {
    return notFoundResponse({
      ...meta,
      message: meta.notFoundMessage ?? "Voo não encontrado na Aviationstack.",
    });
  }
  return mapFlightResult(item, meta);
}

export const FLIGHT_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
