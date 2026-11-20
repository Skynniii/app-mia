import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  doc, deleteField, writeBatch, getDoc, setDoc, updateDoc, deleteDoc, increment,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCollectionStore } from './collectionStore';

/**
 * Elimina recursivamente los valores `undefined` (Firestore no los admite).
 * Preserva sentinelas de Firestore (deleteField, increment, etc.).
 */
export function clean<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(clean) as unknown as T;
  if (obj && typeof obj === 'object') {
    if (typeof (obj as { isEqual?: unknown }).isEqual === 'function') return obj;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[k];
      if (v === undefined) continue;
      out[k] = clean(v);
    }
    return out as unknown as T;
  }
  return obj;
}

// ─── Utilidades ───

function genId(): string {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isDeleteField(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_methodName' in value &&
    (value as { _methodName: string })._methodName === 'deleteField'
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** ¿El documento ya tiene exactamente ese valor? (para no repetir escrituras) */
function sameValue(current: unknown, next: unknown): boolean {
  if (isDeleteField(next)) return current === undefined;
  return current !== undefined && deepEqual(current, next);
}

const noopSubscribe = () => () => {};

// ─── Hook de colección en tiempo real ───

/**
 * Hook para subcolecciones de `users/{uid}` sincronizadas en tiempo real.
 *
 * - Los datos vienen de la caché persistente de Firestore: se pintan al
 *   instante y nunca se descarga la colección completa al abrir la app.
 * - Cualquier cambio (aquí o en otro dispositivo) llega por el listener y se
 *   refleja sin recargar.
 * - Las escrituras van directas a Firestore: sin conexión quedan en cola y se
 *   suben solas al recuperar la señal, en orden (el último cambio gana).
 */
export function useFirestoreCollection<T extends { id: string }>(
  uid: string | null,
  subcollection: string,
) {
  const store = useMemo(
    () => (uid ? getCollectionStore<T>(uid, subcollection) : null),
    [uid, subcollection],
  );
  const emptySnapshot = useMemo(
    () => ({ items: [] as T[], loading: false, ready: false }),
    [],
  );
  const snapshot = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : () => emptySnapshot,
  );

  /** Crea un documento con ID autogenerado localmente. */
  const add = useCallback(async (data: Omit<T, 'id'>): Promise<string> => {
    if (!uid) return '';
    const id = genId();
    const now = new Date().toISOString();
    await setDoc(
      doc(db, 'users', uid, subcollection, id),
      clean({ ...data, id, updatedAt: now }) as DocumentData,
    );
    return id;
  }, [uid, subcollection]);

  /** Crea/reemplaza un documento con ID específico. */
  const set = useCallback(async (id: string, data: Omit<T, 'id'>): Promise<void> => {
    if (!uid) return;
    const now = new Date().toISOString();
    await setDoc(
      doc(db, 'users', uid, subcollection, id),
      clean({ ...data, id, updatedAt: now }) as DocumentData,
    );
  }, [uid, subcollection]);

  /** Actualiza campos de un documento. Usa deleteField() para eliminar campos. */
  const update = useCallback(async (id: string, data: Partial<T>): Promise<void> => {
    if (!uid) return;
    const payload: DocumentData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) payload[key] = value;
    }
    if (Object.keys(payload).length === 0) return;

    // Sin cambios reales: no se gasta una escritura.
    const current = store?.getSnapshot().items.find((i) => i.id === id) as
      | DocumentData
      | undefined;
    if (current && Object.keys(payload).every((k) => sameValue(current[k], payload[k]))) return;

    payload.updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'users', uid, subcollection, id), payload);
    } catch (err) {
      // El documento se borró en otro dispositivo: no se resucita.
      if ((err as { code?: string })?.code !== 'not-found') console.error(err);
    }
  }, [uid, subcollection, store]);

  /** Elimina un documento (el borrado se propaga a todos los dispositivos). */
  const remove = useCallback(async (id: string): Promise<void> => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, 'users', uid, subcollection, id));
    } catch (err) {
      console.error(err);
    }
  }, [uid, subcollection]);

  /** Escribe múltiples documentos completos en un solo lote. */
  const batchSet = useCallback(async (docs: T[]): Promise<void> => {
    if (!uid || docs.length === 0) return;
    const now = new Date().toISOString();
    const BATCH_LIMIT = 450; // Firestore: máx. 500 operaciones por lote
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const item of docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(
          doc(db, 'users', uid, subcollection, item.id),
          clean({ ...item, updatedAt: now }) as DocumentData,
        );
      }
      await batch.commit();
    }
  }, [uid, subcollection]);

  /** Elimina múltiples documentos en un solo lote. */
  const batchRemove = useCallback(async (ids: string[]): Promise<void> => {
    if (!uid || ids.length === 0) return;
    const BATCH_LIMIT = 450;
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + BATCH_LIMIT)) {
        batch.delete(doc(db, 'users', uid, subcollection, id));
      }
      await batch.commit();
    }
  }, [uid, subcollection]);

  return useMemo(() => ({
    items: snapshot.items,
    loading: snapshot.loading,
    ready: snapshot.ready,
    add, set, update, remove, batchSet, batchRemove,
  }), [snapshot, add, set, update, remove, batchSet, batchRemove]);
}

// ─── Función auxiliar: incrementar tiempo de tarea ───

/**
 * Suma segundos a `totalTimeSpent` de una tarea.
 * Usa `increment()`: es atómico y no se pierden sumas concurrentes.
 */
export async function incrementTaskTime(uid: string, taskId: string, seconds: number): Promise<void> {
  if (!uid || !taskId || !seconds) return;
  try {
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
      totalTimeSpent: increment(seconds),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if ((err as { code?: string })?.code !== 'not-found') console.error(err);
  }
}

// ─── Migración one-time ───

/**
 * Migración one-time: mueve los datos del documento único users/{uid}
 * (formato anterior) a las subcolecciones nuevas.
 * Idempotente: si ya migró, no hace nada.
 */
export async function migrateToSubcollections(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data._migrated_v2) return;

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. taskLists
  if (Array.isArray(data.lumina_lists)) {
    data.lumina_lists.forEach((list: Record<string, unknown>, i: number) => {
      batch.set(doc(db, 'users', uid, 'taskLists', String(list.id)), clean({
        name: list.name,
        position: i,
        createdAt: now,
        updatedAt: now,
        sortMode: list.sortMode,
        hoyListId: list.hoyListId,
      }));
    });
  }

  // 2. tasks
  if (Array.isArray(data.lumina_tasks)) {
    data.lumina_tasks.forEach((task: Record<string, unknown>) => {
      const scheduledDate = task.dueDate || undefined;
      const scheduledTime = task.dueTime || undefined;
      const dueDate = task.deadline || undefined;
      const subtasks = Array.isArray(task.subtasks)
        ? task.subtasks.map((s: Record<string, unknown>) => ({
            id: String(s.id),
            title: String(s.text ?? s.title ?? ''),
            completed: !!s.completed,
          }))
        : undefined;
      batch.set(doc(db, 'users', uid, 'tasks', String(task.id)), clean({
        listId: task.listId,
        title: task.text ?? task.title,
        completed: task.completed ?? false,
        isImportant: task.isImportant ?? false,
        createdAt: now,
        updatedAt: now,
        notes: task.notes || undefined,
        scheduledDate,
        scheduledTime,
        dueDate,
        activityId: task.activityId || undefined,
        completedAt: task.completedAt || undefined,
        subtasks,
        repeat: task.repeat,
        totalTimeSpent: task.totalTimeSpent || undefined,
      }));
    });
  }

  // 3. activities
  if (Array.isArray(data['tracker-activities'])) {
    data['tracker-activities'].forEach((act: Record<string, unknown>) => {
      batch.set(doc(db, 'users', uid, 'activities', String(act.id)), clean({
        name: act.name,
        color: act.color,
        updatedAt: now,
      }));
    });
  }

  // 4. timeSessions (from tracker-entries)
  if (Array.isArray(data['tracker-entries'])) {
    data['tracker-entries'].forEach((entry: Record<string, unknown>) => {
      const startedAt = Number(entry.startedAt);
      const endedAt = Number(entry.endedAt);
      batch.set(doc(db, 'users', uid, 'timeSessions', String(entry.id)), clean({
        taskId: entry.taskId || undefined,
        activityId: entry.activityId || '',
        description: entry.description || '',
        notes: entry.notes || undefined,
        startTime: new Date(startedAt).toISOString(),
        endTime: new Date(endedAt).toISOString(),
        duration: Number(entry.seconds) || 0,
        mode: 'stopwatch' as const,
        createdAt: new Date(endedAt).toISOString(),
        updatedAt: now,
      }));
    });
  }

  // 5. calendarEvents
  if (Array.isArray(data['calendar-events'])) {
    data['calendar-events'].forEach((ev: Record<string, unknown>) => {
      batch.set(doc(db, 'users', uid, 'calendarEvents', String(ev.id)), clean({
        title: ev.title,
        date: ev.date,
        start: ev.start,
        end: ev.end,
        color: ev.color,
        location: ev.location || undefined,
        notes: ev.notes || undefined,
        updatedAt: now,
      }));
    });
  }

  // Marca migración y limpia campos antiguos
  batch.update(userRef, {
    _migrated_v2: true,
    lumina_lists: deleteField(),
    lumina_tasks: deleteField(),
    'tracker-activities': deleteField(),
    'tracker-entries': deleteField(),
    'calendar-events': deleteField(),
  });

  await batch.commit();
}
