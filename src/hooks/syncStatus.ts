/**
 * Estado global de sincronización.
 *
 * Solo alimenta el indicador discreto de la interfaz ("Sincronizando…" /
 * "Sin conexión"): no participa en la sincronización de datos, que la resuelve
 * Firestore con su caché persistente y su cola de escrituras.
 */
import { useSyncExternalStore } from 'react';

export interface SyncStatus {
  /** Hay escrituras locales esperando confirmación del servidor. */
  pending: boolean;
  offline: boolean;
}

const pendingKeys = new Set<string>();
const listeners = new Set<() => void>();
const isBrowser = typeof window !== 'undefined';

let offline = isBrowser ? !navigator.onLine : false;
let snapshot: SyncStatus = { pending: false, offline };

function emit(): void {
  const next: SyncStatus = { pending: pendingKeys.size > 0, offline };
  if (next.pending === snapshot.pending && next.offline === snapshot.offline) return;
  snapshot = next;
  listeners.forEach((cb) => cb());
}

/** Cada colección (y el documento raíz) informa si tiene escrituras sin confirmar. */
export function reportPendingWrites(key: string, hasPending: boolean): void {
  if (hasPending) {
    if (pendingKeys.has(key)) return;
    pendingKeys.add(key);
  } else if (!pendingKeys.delete(key)) {
    return;
  }
  emit();
}

export function reportOffline(value: boolean): void {
  offline = value;
  emit();
}

if (isBrowser) {
  window.addEventListener('online', () => reportOffline(false));
  window.addEventListener('offline', () => reportOffline(true));
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SyncStatus {
  return snapshot;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
