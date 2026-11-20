import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import type { CustomInterval } from '../../hooks/useTimerSettings';

interface Props {
  isOpen: boolean;
  /** Intervalo a editar; sin él, el modal crea uno nuevo. */
  interval?: CustomInterval | null;
  onClose: () => void;
  onSave: (interval: CustomInterval) => void;
  onDelete?: (id: string) => void;
}

function Stepper({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[14px] text-[#555]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="w-8 h-8 rounded-full bg-[#f7f6f9] border-none cursor-pointer flex items-center justify-center text-[#7f70ff] active:scale-90 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <span className="text-[14px] font-semibold text-[#333] tabular-nums w-[64px] text-center">{value} {suffix}</span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="w-8 h-8 rounded-full bg-[#f7f6f9] border-none cursor-pointer flex items-center justify-center text-[#7f70ff] active:scale-90 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
    </div>
  );
}

/** Crear o editar un intervalo personalizado del modo "Intervalos". */
export function IntervalFormModal({ isOpen, interval, onClose, onSave, onDelete }: Props) {
  useBackHandler(isOpen, onClose);
  const [name, setName] = useState('');
  const [focusMin, setFocusMin] = useState(25);
  const [restMin, setRestMin] = useState(5);
  const [rounds, setRounds] = useState(4);

  useEffect(() => {
    if (!isOpen) return;
    setName(interval?.name ?? '');
    setFocusMin(interval?.focusMin ?? 25);
    setRestMin(interval?.restMin ?? 5);
    setRounds(interval?.rounds ?? 4);
  }, [isOpen, interval]);

  const save = () => {
    const clean = name.trim() || 'Intervalo';
    onSave({ id: interval?.id ?? `iv-${Date.now()}`, name: clean, focusMin, restMin, rounds });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[10001] flex items-center justify-center" onClick={onClose}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-3xl z-[10002] flex flex-col shadow-[0_12px_40px_rgba(0,0,0,0.15)] mx-5"
              style={{ width: 'min(340px, 90vw)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-1 flex items-center justify-between shrink-0">
                <span className="text-[16px] font-bold text-[#333]">{interval ? 'Editar intervalo' : 'Nuevo intervalo'}</span>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f7f6f9] border-none cursor-pointer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-5 pt-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del intervalo"
                  className="w-full border border-[#e4e4ed] rounded-xl py-2.5 px-3.5 text-[15px] text-[#333] bg-[#fafafc] outline-none focus:border-[#7f70ff] focus:bg-white transition-colors mb-1"
                />
                <div className="divide-y divide-[#f2f2f6]">
                  <Stepper label="Enfoque" value={focusMin} min={1} max={180} suffix="min" onChange={setFocusMin} />
                  <Stepper label="Descanso" value={restMin} min={1} max={60} suffix="min" onChange={setRestMin} />
                  <Stepper label="Rondas" value={rounds} min={1} max={12} suffix="rondas" onChange={setRounds} />
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 flex gap-2">
                {interval && onDelete && (
                  <button
                    onClick={() => { onDelete(interval.id); onClose(); }}
                    className="px-4 py-3.5 rounded-2xl text-[15px] font-bold text-[#ff6b81] bg-[#fff1f3] border-none cursor-pointer"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={save}
                  className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold text-white bg-[#7f70ff] border-none cursor-pointer shadow-[0_4px_12px_rgba(127,112,255,0.25)]"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
