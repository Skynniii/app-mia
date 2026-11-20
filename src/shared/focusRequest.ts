/**
 * Petición de abrir la pantalla Focus (el cronómetro a pantalla completa,
 * dentro de la sección Timer) desde cualquier punto de la app.
 *
 * El pedido se guarda en memoria hasta que la sección Timer lo atiende: así
 * funciona tanto si ya estaba montada como si se entra a ella en ese momento.
 */
let pending = false;
const listeners = new Set<() => void>();

export function requestFocusView(): void {
  pending = true;
  listeners.forEach((cb) => cb());
}

export function subscribeFocusRequest(cb: () => void): () => void {
  listeners.add(cb);
  if (pending) {
    pending = false;
    cb();
  }
  return () => {
    listeners.delete(cb);
  };
}
