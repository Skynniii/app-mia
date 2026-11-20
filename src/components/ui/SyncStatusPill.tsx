import { useEffect, useState } from 'react';
import { useSyncStatus } from '../../hooks/syncStatus';

/**
 * Aviso discreto del estado de sincronización.
 *
 * No aparece si todo está guardado: solo mientras hay escrituras pendientes o
 * el dispositivo está sin conexión (en ese caso los cambios se subirán solos).
 */
export function SyncStatusPill() {
  const { pending, offline } = useSyncStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Pequeña espera: una escritura normal se confirma en milisegundos y no
    // hace falta avisar de nada.
    if (!pending && !offline) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(timer);
  }, [pending, offline]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[120] pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 shadow-[0_2px_10px_rgba(0,0,0,0.12)] border border-[#eceaf3]"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {offline ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2l20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.5a10 10 0 0 1 3-2" /><path d="M19 12.5a10 10 0 0 0-3-2" />
          </svg>
          <span className="text-[11px] font-medium text-[#8a6d3b]">Sin conexión · se guardará</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full border border-[#7f70ff] border-t-transparent animate-spin" />
          <span className="text-[11px] font-medium text-[#6b6b6b]">Sincronizando…</span>
        </>
      )}
    </div>
  );
}
