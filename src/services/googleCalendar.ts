import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { CalendarEvent, GoogleCalendarLink } from '../types';
import { HOLIDAY_COLOR } from '../utils/holidays';
import { expandIcs, parseIcs, type IcsOccurrence } from '../utils/ics';

/** Paleta de los eventos (la misma que usa el calendario). */
const EVENT_COLORS = ['#4d7cfe', '#7f70ff', '#9d51ff', '#34c77b', '#00b8a9', '#ffa94d', '#ff6b81', '#f26f5b'];
const BIRTHDAY_COLOR = '#ff6b81';

/** Ventana de importación: un año atrás y dos adelante. */
function importWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: key(from), to: key(to) };
}

/** Hash corto y estable para el id de cada evento importado. */
function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function linkIdForUrl(url: string): string {
  return `gc-${hash(normalizeUrl(url))}`;
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//i, 'https://');
}

/** Descarga con límite de tiempo (una petición colgada no bloquea la UI). */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Primera promesa que resuelve; si fallan todas, se rechaza. */
function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let pending = promises.length;
    if (pending === 0) { reject(new Error('sin intentos')); return; }
    for (const promise of promises) {
      promise.then(resolve).catch(() => {
        pending -= 1;
        if (pending === 0) reject(new Error('todos los intentos fallaron'));
      });
    }
  });
}

/**
 * Descarga un .ics por su dirección. En el APK usa la petición nativa de
 * Capacitor (sin CORS); en el navegador intenta una descarga directa y, si el
 * calendario no permite CORS, pasa por un proxy público de solo lectura.
 */
async function fetchIcsText(url: string): Promise<string> {
  const target = normalizeUrl(url);

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: target,
      headers: { Accept: 'text/calendar' },
      responseType: 'text',
      connectTimeout: 12000,
      readTimeout: 20000,
    });
    if (res.status >= 200 && res.status < 300 && typeof res.data === 'string') return res.data;
    throw new Error(`Google respondió ${res.status}`);
  }

  const direct = await fetchWithTimeout(target, 5000).catch(() => null);
  if (direct?.ok) {
    const text = await direct.text();
    if (text.includes('BEGIN:VCALENDAR')) return text;
  }

  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  try {
    return await firstSuccess(proxies.map(async (proxy) => {
      const res = await fetchWithTimeout(proxy(target), 9000);
      const text = res.ok ? await res.text() : '';
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('sin calendario');
      return text;
    }));
  } catch {
    throw new Error('No se pudo descargar el calendario. En la app de Android se trae directamente; en el navegador revisa el enlace o la conexión.');
  }
}

/** Tipo de calendario según su nombre de Google (Cumpleaños, Festivos…). */
export function detectKind(name: string, url: string, fallback: GoogleCalendarLink['kind'] = 'calendar'): GoogleCalendarLink['kind'] {
  const text = `${name} ${url}`.toLowerCase();
  if (text.includes('#contact') || text.includes('birthday') || text.includes('cumplea')) return 'birthday';
  if (text.includes('#holiday') || text.includes('holiday') || text.includes('festiv')) return 'holiday';
  return fallback;
}

/** Lee un calendario de Google y devuelve su nombre y sus eventos expandidos. */
export async function fetchGoogleCalendar(link: GoogleCalendarLink): Promise<{
  name: string;
  kind: GoogleCalendarLink['kind'];
  occurrences: IcsOccurrence[];
}> {
  const text = await fetchIcsText(link.url);
  const parsed = parseIcs(text);
  if (parsed.events.length === 0 && !parsed.name) throw new Error('El enlace no contiene un calendario válido.');
  const name = parsed.name?.trim() || link.name || 'Google Calendar';
  const kind = detectKind(name, link.url, link.kind);
  const { from, to } = importWindow();
  return { name, kind, occurrences: expandIcs(parsed.events, from, to) };
}

/** Convierte las ocurrencias del ICS en eventos de la app (documentos de calendarEvents). */
export function toCalendarEvents(link: GoogleCalendarLink, occurrences: IcsOccurrence[]): CalendarEvent[] {
  const seen = new Set<string>();
  const out: CalendarEvent[] = [];

  for (const occ of occurrences) {
    const title = occ.title;
    if (!title) continue;
    const id = `g-${link.id}-${hash(`${occ.uid}|${occ.date}|${occ.start ?? ''}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const kind = link.kind === 'calendar' ? detectKind(title, '', 'calendar') : link.kind;
    const birthday = kind === 'birthday';
    const holiday = kind === 'holiday';

    out.push({
      id,
      title,
      date: occ.date,
      start: occ.allDay ? '00:00' : occ.start ?? '00:00',
      end: occ.allDay ? '23:59' : occ.end ?? occ.start ?? '23:59',
      color: holiday ? HOLIDAY_COLOR : birthday ? BIRTHDAY_COLOR : link.color,
      location: occ.location,
      notes: occ.description,
      birthday: birthday || undefined,
      yearly: occ.yearly || undefined,
      allDay: occ.allDay || undefined,
      holiday: holiday || undefined,
      source: 'google',
      googleCalendarId: link.id,
      googleUid: occ.uid,
    });
  }
  return out;
}

/** Color para un nuevo vínculo (rota por la paleta de eventos). */
export function colorForLink(existing: GoogleCalendarLink[]): string {
  return EVENT_COLORS[existing.length % EVENT_COLORS.length];
}

/** ¿Hay que volver a sincronizar? (cada 6 horas) */
export function linkIsStale(link: GoogleCalendarLink): boolean {
  if (!link.lastSync) return true;
  const last = Date.parse(link.lastSync);
  return !Number.isFinite(last) || Date.now() - last > 6 * 60 * 60 * 1000;
}

/** Texto de la última sincronización, para la UI. */
export function lastSyncLabel(link: GoogleCalendarLink): string {
  if (!link.lastSync) return 'Sin sincronizar';
  const d = new Date(link.lastSync);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `Hoy ${time}` : `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} ${time}`;
}
