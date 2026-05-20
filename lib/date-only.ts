const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 86_400_000;

/** Extrai `YYYY-MM-DD` de strings date-only ou ISO (ex.: `2026-08-01T00:00:00Z`). */
export function extractDateOnly(value: string): string | null {
  const m = value.trim().match(DATE_ONLY_RE);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Garante `YYYY-MM-DD` para gravar em colunas DATE (evita +1 dia por ISO/UTC). */
export function normalizeDateOnly(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return extractDateOnly(value.trim());
}

export function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parseia `YYYY-MM-DD` como meia-noite local (evita shift de timezone). */
export function parseDateOnlyToLocal(dateOnly: string) {
  const iso = extractDateOnly(dateOnly);
  if (!iso) return new Date(Number.NaN);
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

/** `YYYY-MM-DD` no fuso local (para filtros Supabase, sem usar UTC de `toISOString`). */
export function toLocalDateOnlyString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calendarDaysBetween(start: Date, end: Date) {
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return (utcEnd - utcStart) / MS_PER_DAY;
}

/** Diferença em dias de calendário entre hoje e a data (0 = hoje, 1 = amanhã). */
export function calendarDaysFromToday(dateOnly: string, now = new Date()) {
  const today = startOfLocalDay(now);
  const target = startOfLocalDay(parseDateOnlyToLocal(dateOnly));
  if (Number.isNaN(target.getTime())) return Number.NaN;
  return calendarDaysBetween(today, target);
}

/** Dias de calendário até o embarque (0 = hoje, 1 = amanhã, negativo = passado). */
export function diffDaysFromToday(dateOnly: string, now = new Date()) {
  return calendarDaysFromToday(dateOnly, now);
}

export function formatDateOnlyLocal(dateOnly: string) {
  const d = parseDateOnlyToLocal(dateOnly);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}
