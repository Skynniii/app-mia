/**
 * Almacén compartido por colección (una sola suscripción a Firestore por
 * usuario y colección, sin importar cuántos componentes la usen).
 *
 * Reutilizar una única consulta evita descargas y listeners duplicados: al
 * navegar entre secciones los datos ya están en memoria y se pintan al
 * instante, y cada cambio remoto sigue llegando en tiempo real.
 */
import { collection, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { reportPendingWrites } from './syncStatus';

export interface CollectionState<T> {
  items: T[];
  loading: boolean;
  /** true cuando ya llegó al menos un snapshot del SERVIDOR (no solo caché). */
  ready: boolean;
}

export class CollectionStore<T extends { id: string }> {
  readonly key: string;
  private readonly name: string;
  private snapshot: CollectionState<T> = { items: [], loading: true, ready: false };
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;

  constructor(uid: string, name: string) {
    this.name = name;
    this.key = `${uid}:${name}`;
    this.attach(uid);
  }

  getSnapshot = (): CollectionState<T> => this.snapshot;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.listeners.clear();
  }

  private emit(next: CollectionState<T>): void {
    this.snapshot = next;
    this.listeners.forEach((cb) => cb());
  }

  private attach(uid: string): void {
    this.unsub = onSnapshot(
      collection(db, 'users', uid, this.name),
      // Los metadatos permiten saber si quedan escrituras pendientes y si el
      // snapshot viene de la caché local o del servidor.
      { includeMetadataChanges: true },
      (snap) => {
        reportPendingWrites(this.key, snap.metadata.hasPendingWrites);

        // docChanges() ignora los cambios que solo afectan a metadatos: así un
        // acuse del servidor no reconstruye la lista ni repinta la interfaz.
        const changed = snap.docChanges().length > 0;
        const ready = this.snapshot.ready || !snap.metadata.fromCache;
        if (!changed && ready === this.snapshot.ready) return;

        const items = changed
          ? (snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as T[])
          : this.snapshot.items;
        this.emit({ items, loading: false, ready });
      },
      (err) => {
        console.error(`Firestore listener (${this.name}):`, err);
        if (this.snapshot.loading) {
          this.emit({ items: [], loading: false, ready: this.snapshot.ready });
        }
      },
    );
  }
}

const stores = new Map<string, CollectionStore<{ id: string }>>();

export function getCollectionStore<T extends { id: string }>(
  uid: string,
  name: string,
): CollectionStore<T> {
  const key = `${uid}:${name}`;
  let store = stores.get(key);
  if (!store) {
    store = new CollectionStore<{ id: string }>(uid, name);
    stores.set(key, store);
  }
  return store as unknown as CollectionStore<T>;
}

/** Cierra todas las suscripciones (al cerrar sesión o cambiar de cuenta). */
export function resetCollectionStores(): void {
  stores.forEach((store) => store.dispose());
  stores.clear();
}
