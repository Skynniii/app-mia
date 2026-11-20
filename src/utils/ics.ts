/**
 * Lector mínimo de archivos iCalendar (.ics): lo justo para importar los
 * calendarios de Google (eventos, cumpleaños y festivos) sin dependencias.
 *
 * - Deshace el plegado de líneas del formato (continuaciones con espacio/tab).
 * - Lee `DTSTART`/`DTEND` (fecha, fecha-hora local o UTC), `SUMMARY`,
 *   `LOCATION`, `DESCRIPTION`, `RRULE` y `STATUS`.
 * - Expande las series repetidas (diaria, semanal, mensual y anual) dentro de
 *   una ventana de fechas; las anuales se devuelven una sola vez para que la
 *   app las repita por año.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  date: string;              // YYYY-MM-DD de la primera ocurrencia
  start?: string;            // HH:MM (solo eventos con hora)
  end?: string;              // HH:MM
  rrule?: string;
  cancelled?: boolean;
}

export interface IcsOccurrence {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  date: string;
  start?: string;
  end?: string;
  /** Serie anual: la app la repite cada año (cumpleaños y aniversarios). */
  yearly: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Texto de una propiedad iCalendar: quita escapes y espacios sobrantes. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/** Separa `NOMBRE;PARAM=VALOR;...:valor`. */
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.trim().toUpperCase(), params, value };
}

type ParsedDate = { date: string; time?: string };

/** `20261115` / `20261115T093000` / `20261115T143000Z`. */
function parseDate(value: string, params: Record<string, string>): ParsedDate | null {
  const v = value.trim();
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    if (!/^\d{8}$/.test(v)) return null;
    return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    // UTC: se pasa a la hora local del dispositivo
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
    return { date: toKey(dt), time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
  }
  // Con o sin TZID se conserva la hora de pared (la app es local)
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

/** Deshace el plegado de líneas y devuelve los VEVENT del archivo. */
export function parseIcs(text: string): { name?: string; events: IcsEvent[] } {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events: IcsEvent[] = [];
  let name: string | undefined;
  let current: Record<string, { params: Record<string, string>; value: string }> | null = null;

  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) { current = {}; continue; }
    if (/^END:VEVENT$/i.test(line)) {
      if (current) {
        const dtStart = current.DTSTART;
        const start = dtStart ? parseDate(dtStart.value, dtStart.params) : null;
        if (start && current.SUMMARY) {
          const dtEnd = current.DTEND ? parseDate(current.DTEND.value, current.DTEND.params) : null;
          const allDay = !start.time;
          let end: string | undefined;
          if (!allDay && dtEnd?.time && dtEnd.date === start.date) {
            const minutes = toMinutes(dtEnd.time);
            if (minutes > toMinutes(start.time!)) end = fromMinutes(minutes);
          }
          events.push({
            uid: current.UID?.value?.trim() || `${start.date}-${current.SUMMARY.value}`,
            title: unescapeText(current.SUMMARY.value),
            description: current.DESCRIPTION ? unescapeText(current.DESCRIPTION.value) : undefined,
            location: current.LOCATION ? unescapeText(current.LOCATION.value) : undefined,
            allDay,
            date: start.date,
            start: start.time,
            end,
            rrule: current.RRULE?.value?.toUpperCase(),
            cancelled: current.STATUS?.value?.toUpperCase() === 'CANCELLED',
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) {
      const parsed = parseLine(line);
      if (parsed?.name === 'X-WR-CALNAME') name = unescapeText(parsed.value);
      continue;
    }
    const parsed = parseLine(line);
    if (parsed) current[parsed.name] = { params: parsed.params, value: parsed.value };
  }

  return { name, events };
}

interface Rule {
  freq?: string;
  interval: number;
  until?: string;
  count?: number;
  byDay: string[];
  byMonthDay?: number;
}

function parseRule(value: string): Rule {
  const rule: Rule = { interval: 1, byDay: [] };
  for (const part of value.split(';')) {
    const [rawKey, rawValue = ''] = part.split('=');
    const key = rawKey.trim().toUpperCase();
    const v = rawValue.trim();
    if (key === 'FREQ') rule.freq = v.toUpperCase();
    else if (key === 'INTERVAL') rule.interval = Math.max(1, Number(v) || 1);
    else if (key === 'UNTIL') {
      const until = parseDate(v, {});
      if (until) rule.until = until.date;
    } else if (key === 'COUNT') rule.count = Math.max(1, Number(v) || 1);
    else if (key === 'BYDAY') rule.byDay = v.split(',').map((d) => d.trim().toUpperCase());
    else if (key === 'BYMONTHDAY') rule.byMonthDay = Number(v) || undefined;
  }
  return rule;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Ocurrencias de un evento dentro de `[from, to]` (fechas YYYY-MM-DD).
 * Las series anuales se devuelven una sola vez con `yearly: true`.
 */
export function expandEvent(event: IcsEvent, from: string, to: string): IcsOccurrence[] {
  if (event.cancelled) return [];
  const base: Omit<IcsOccurrence, 'date' | 'yearly'> = {
    uid: event.uid,
    title: event.title,
    description: event.description,
    location: event.location,
    allDay: event.allDay,
    start: event.start,
    end: event.end,
  };

  if (!event.rrule) {
    return event.date >= from && event.date <= to ? [{ ...base, date: event.date, yearly: false }] : [];
  }

  const rule = parseRule(event.rrule);

  if (rule.freq === 'YEARLY') {
    if (rule.until && rule.until < from) return [];
    return [{ ...base, date: event.date, yearly: true }];
  }

  const out: IcsOccurrence[] = [];
  const startDate = new Date(`${event.date}T00:00:00`);
  const endDate = new Date(`${to}T23:59:59`);
  const untilDate = rule.until ? new Date(`${rule.until}T23:59:59`) : null;
  const max = 500;
  let emitted = 0;
  let occurrences = 0;

  const push = (d: Date) => {
    if (untilDate && d > untilDate) return;
    occurrences += 1;
    if (rule.count && occurrences > rule.count) return;
    const key = toKey(d);
    if (key < from || key > to) return;
    if (emitted >= max) return;
    out.push({ ...base, date: key, yearly: false });
    emitted += 1;
  };

  if (rule.freq === 'DAILY') {
    const d = new Date(startDate);
    let guard = 0;
    while (d <= endDate && emitted < max && guard < 5000) {
      if (untilDate && d > untilDate) break;
      push(new Date(d));
      d.setDate(d.getDate() + rule.interval);
      guard += 1;
    }
    return out;
  }

  if (rule.freq === 'WEEKLY') {
    const days = rule.byDay.length
      ? rule.byDay.map((d) => WEEKDAYS.indexOf(d)).filter((i) => i >= 0)
      : [startDate.getDay()];
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() - Math.min(...days) + 7) % 7));
    const d = new Date(weekStart);
    let guard = 0;
    while (d <= endDate && emitted < max && guard < 4000) {
      for (const wd of days.sort((a, b) => a - b)) {
        const day = new Date(d);
        day.setDate(day.getDate() + ((wd - d.getDay() + 7) % 7));
        if (day >= startDate) push(day);
        if (emitted >= max) break;
      }
      d.setDate(d.getDate() + 7 * rule.interval);
      guard += 1;
    }
    return out;
  }

  if (rule.freq === 'MONTHLY') {
    const d = new Date(startDate);
    let guard = 0;
    while (d <= endDate && emitted < max && guard < 400) {
      push(new Date(d.getFullYear(), d.getMonth(), rule.byMonthDay ?? startDate.getDate()));
      d.setMonth(d.getMonth() + rule.interval);
      guard += 1;
    }
    return out;
  }

  // Frecuencias no soportadas (p. ej. HOURLY): se importa la primera fecha
  return event.date >= from && event.date <= to ? [{ ...base, date: event.date, yearly: false }] : [];
}

/** Todas las ocurrencias de un archivo, ordenadas por fecha. */
export function expandIcs(events: IcsEvent[], from: string, to: string): IcsOccurrence[] {
  const out: IcsOccurrence[] = [];
  for (const e of events) out.push(...expandEvent(e, from, to));
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}
