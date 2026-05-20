export type EmbarqueAlertOffsetDays = 7 | 5 | 3 | 0;

export const EMBARQUE_ALERT_OFFSETS: EmbarqueAlertOffsetDays[] = [7, 5, 3, 0];

export {
  calendarDaysFromToday,
  diffDaysFromToday,
  formatDateOnlyLocal,
  normalizeDateOnly,
  parseDateOnlyToLocal,
  startOfLocalDay,
  toLocalDateOnlyString,
} from "@/lib/date-only";

export function embarqueAlertTitle(diffDays: number) {
  if (diffDays === 0) return "Hoje é dia de embarque";
  if (diffDays === 1) return "Falta 1 dia para o embarque";
  return `Faltam ${diffDays} dias para o embarque`;
}
