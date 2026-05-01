"use client";

export type Aeroporto = {
  codigo: string;
  nome: string;
  cidade: string;
  estado?: string;
  pais: string;
};

export type Companhia = {
  codigo: string;
  nome: string;
  pais: string;
  icao?: string;
  aliance?: string | null;
};

let aeroportosCache: Aeroporto[] | null = null;
let aeroportosPromise: Promise<Aeroporto[]> | null = null;

export async function loadAeroportos(): Promise<Aeroporto[]> {
  if (aeroportosCache) return aeroportosCache;
  if (!aeroportosPromise) {
    aeroportosPromise = fetch("/data/aeroportos.json")
      .then((r) => r.json() as Promise<Aeroporto[]>)
      .then((data) => {
        aeroportosCache = data;
        return data;
      });
  }
  return aeroportosPromise;
}

let companhiasCache: Companhia[] | null = null;
let companhiasPromise: Promise<Companhia[]> | null = null;

export async function loadCompanhias(): Promise<Companhia[]> {
  if (companhiasCache) return companhiasCache;
  if (!companhiasPromise) {
    companhiasPromise = fetch("/data/companhias-aereas.json")
      .then((r) => r.json() as Promise<Companhia[]>)
      .then((data) => {
        companhiasCache = data;
        return data;
      });
  }
  return companhiasPromise;
}

export function searchAeroportos(query: string, list: Aeroporto[], limit = 30): Aeroporto[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  return list
    .filter(
      (a) =>
        a.codigo.toLowerCase().includes(q) ||
        a.nome.toLowerCase().includes(q) ||
        a.cidade.toLowerCase().includes(q) ||
        a.pais.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

export function searchCompanhias(query: string, list: Companhia[], limit = 30): Companhia[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  return list
    .filter(
      (c) =>
        c.codigo.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        c.pais.toLowerCase().includes(q) ||
        (c.icao ?? "").toLowerCase().includes(q),
    )
    .slice(0, limit);
}
