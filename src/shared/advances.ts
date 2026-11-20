import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { getCollectionStore } from '../hooks/collectionStore';
import type { Task } from '../types';

/**
 * Avances (tareas vinculadas) pendientes de una tarea original.
 * Se leen del almacén compartido: no abre ninguna consulta nueva.
 */
export function pendingAdvancesOf(uid: string, taskId: string): Task[] {
  if (!uid || !taskId) return [];
  return getCollectionStore<Task>(uid, 'tasks').getSnapshot().items
    .filter((t) => t.linkedTaskId === taskId && !t.completed);
}

/**
 * Completa todos los avances existentes de una tarea en un solo lote.
 * Se usa al finalizar el registro de la tarea original: sus avances cuentan
 * como registrados y quedan completados con ella.
 */
export async function completeTaskAdvances(uid: string, taskId: string): Promise<void> {
  const advances = pendingAdvancesOf(uid, taskId);
  if (advances.length === 0) return;
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    advances.forEach((t) => batch.update(doc(db, 'users', uid, 'tasks', t.id), {
      completed: true, completedAt: now, updatedAt: now,
    }));
    await batch.commit();
  } catch (err) {
    console.error(err);
  }
}
