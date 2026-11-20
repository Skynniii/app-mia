import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserStorage } from './useUserStorage';
import { useFirestoreCollection } from './useFirestoreCollection';
import type { CalendarEvent, GoogleCalendarLink } from '../types';
import {
  colorForLink, fetchGoogleCalendar, lastSyncLabel, linkIdForUrl, linkIsStale,
  normalizeUrl, toCalendarEvents,
} from '../services/googleCalendar';

/** Evita que dos instancias de la app (Calendario y Configuración) sincronicen a la vez. */
let syncingNow = false;

function sameEvent(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.title === b.title
    && a.date === b.date
    && a.start === b.start
    && a.end === b.end
    && (a.location ?? '') === (b.location ?? '')
    && (a.notes ?? '') === (b.notes ?? '')
    && !!a.allDay === !!b.allDay
    && !!a.yearly === !!b.yearly
    && !!a.birthday === !!b.birthday
    && !!a.holiday === !!b.holiday;
}

/**
 * Vinculación con Google Calendar: guarda los calendarios vinculados y
 * sincroniza sus eventos, cumpleaños y festivos con `calendarEvents`.
 * Los eventos importados llevan `source: 'google'` y se actualizan/eliminan
 * por su id, sin tocar los eventos creados a mano.
 */
export function useGoogleCalendar() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [links, setLinks] = useUserStorage<GoogleCalendarLink[]>('google-calendars', []);
  const coll = useFirestoreCollection<CalendarEvent>(uid, 'calendarEvents');
  const [syncing, setSyncing] = useState(syncingNow);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<CalendarEvent[]>([]);
  useEffect(() => {
    itemsRef.current = coll.items;
  }, [coll.items]);

  // Se espera al primer snapshot del SERVIDOR (no solo la caché) para no
  // reescribir eventos que ya están sincronizados.
  const { set: setDoc, remove: removeDoc, ready: eventsReady } = coll;

  const sync = useCallback(async (targets: GoogleCalendarLink[]) => {
    if (!uid || targets.length === 0 || syncingNow) return;
    syncingNow = true;
    setSyncing(true);
    setError(null);
    const results: GoogleCalendarLink[] = [];
    const failures: string[] = [];

    for (const link of targets) {
      try {
        const { name, kind, occurrences } = await fetchGoogleCalendar(link);
        const resolved: GoogleCalendarLink = { ...link, name, kind };
        const docs = toCalendarEvents(resolved, occurrences);
        const current = itemsRef.current.filter((e) => e.source === 'google' && e.googleCalendarId === link.id);
        const incoming = new Set(docs.map((d) => d.id));

        for (const old of current) {
          if (!incoming.has(old.id)) await removeDoc(old.id);
        }
        const byId = new Map(current.map((e) => [e.id, e]));
        for (const doc of docs) {
          const prev = byId.get(doc.id);
          if (prev && sameEvent(prev, doc)) continue;
          await setDoc(doc.id, doc);
        }
        results.push({ ...resolved, lastSync: new Date().toISOString() });
      } catch (e) {
        failures.push(`${link.name || 'Calendario'}: ${(e as Error)?.message ?? 'error al sincronizar'}`);
        results.push(link);
      }
    }

    setLinks((prev) => prev.map((l) => results.find((r) => r.id === l.id) ?? l));
    setError(failures[0] ?? null);
    syncingNow = false;
    setSyncing(false);
  }, [uid, setDoc, removeDoc, setLinks]);

  /** Sincroniza los calendarios que llevan más de 6 horas sin actualizarse. */
  useEffect(() => {
    if (!uid || !eventsReady) return;
    const stale = links.filter(linkIsStale);
    if (stale.length === 0) return;
    const timer = setTimeout(() => { void sync(stale); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, eventsReady, links.length]);

  /** Valida el enlace, guarda el vínculo y trae sus eventos. */
  const addLink = useCallback(async (rawUrl: string): Promise<void> => {
    const url = normalizeUrl(rawUrl);
    if (!/^https?:\/\//i.test(url)) throw new Error('Pega la dirección secreta en formato iCal (empieza por https://).');
    const id = linkIdForUrl(url);
    if (links.some((l) => l.id === id)) throw new Error('Ese calendario ya está vinculado.');

    const draft: GoogleCalendarLink = {
      id,
      url,
      name: 'Google Calendar',
      kind: 'calendar',
      color: colorForLink(links),
    };
    const { name, kind } = await fetchGoogleCalendar(draft);
    const link: GoogleCalendarLink = { ...draft, name, kind };
    setLinks((prev) => [...prev, link]);
    await sync([link]);
  }, [links, setLinks, sync]);

  const removeLink = useCallback(async (id: string): Promise<void> => {
    const imported = itemsRef.current.filter((e) => e.source === 'google' && e.googleCalendarId === id);
    for (const e of imported) await removeDoc(e.id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, [removeDoc, setLinks]);

  const syncNow = useCallback(async (): Promise<void> => {
    await sync(links);
  }, [links, sync]);

  return {
    links, syncing, error,
    addLink, removeLink, syncNow,
    lastSyncLabel,
  };
}
