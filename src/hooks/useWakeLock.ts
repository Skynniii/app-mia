import { useEffect } from 'react';

type WakeLockLike = {
  request: (type: 'screen') => Promise<{ release: () => Promise<void> }>;
};

/**
 * Mantiene la pantalla encendida mientras `active` es true (Screen Wake Lock).
 * El bloqueo se pierde al ocultar la pestaña; se vuelve a pedir al volver.
 * En navegadores sin soporte no hace nada.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const s = await wakeLock.request('screen');
        if (cancelled) { void s.release(); return; }
        sentinel = s;
      } catch {
        /* el sistema puede negarlo (batería baja, pestaña en segundo plano) */
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !sentinel) void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sentinel) void sentinel.release();
      sentinel = null;
    };
  }, [active]);
}
