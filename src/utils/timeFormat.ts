export type TimeFormat = '12h' | '24h';

/**
 * Hora legible según el formato elegido. En 12 h el sufijo va siempre como
 * "AM"/"PM" pegado a la hora ("2:42 PM"), nunca como "p. m.".
 */
export function formatTimeParts(hour: number, minute: number, timeFormat: TimeFormat, second?: number): string {
  const mins = String(minute).padStart(2, '0');
  const secs = second === undefined ? '' : `:${String(second).padStart(2, '0')}`;
  if (timeFormat === '24h') return `${String(hour).padStart(2, '0')}:${mins}${secs}`;
  return `${hour % 12 || 12}:${mins}${secs} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/** "HH:mm" (24 h) → hora legible según el formato elegido. */
export function formatHHMM(hhmm: string, timeFormat: TimeFormat): string {
  const [h, m] = hhmm.split(':').map(Number);
  return formatTimeParts(h, m, timeFormat);
}

/** Fecha/epoch/ISO → hora legible según el formato elegido. */
export function formatClockDate(value: number | string | Date, timeFormat: TimeFormat, withSeconds = false): string {
  const d = new Date(value);
  return formatTimeParts(d.getHours(), d.getMinutes(), timeFormat, withSeconds ? d.getSeconds() : undefined);
}
