export type EmbarqueAlertOffsetDays = 7 | 5 | 3 | 0;

export const EMBARQUE_ALERT_OFFSETS: EmbarqueAlertOffsetDays[] = [7, 5, 3, 0];

export function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parseia `YYYY-MM-DD` como meia-noite local (evita shift de timezone). */
export function parseDateOnlyToLocal(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function diffDaysFromToday(dateOnly: string, now = new Date()) {
  const today = startOfLocalDay(now).getTime();
  const target = startOfLocalDay(parseDateOnlyToLocal(dateOnly)).getTime();
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export function embarqueAlertTitle(diffDays: number) {
  if (diffDays === 0) return "Hoje é dia de embarque";
  if (diffDays === 1) return "Falta 1 dia para o embarque";
  return `Faltam ${diffDays} dias para o embarque`;
}

