import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { MAX_INTERVAL_STEPS, intervalStepName, type CustomInterval, type IntervalStep } from '../../hooks/useTimerSettings';
import { CustomDurationModal } from './CustomDurationModal';

interface Props {
  isOpen: boolean;
  /** Intervalo a editar; sin él, el modal crea uno nuevo. */
  interval?: CustomInterval | null;
  onClose: () => void;
  onSave: (interval: CustomInterval) => void;
  onDelete?: (id: string) => void;
}

const newStep = (index: number): IntervalStep => ({
  id: `st-${Date.now()}-${index}`,
  name: intervalStepName(index),
  minutes: 5,
});

/** Crear o editar una secuencia de intervalos del modo "Intervalos". */
export function IntervalFormModal({ isOpen, interval, onClose, onSave, onDelete }: Props) {
  useBackHandler(isOpen, onClose);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<IntervalStep[]>([]);
  const [durationIndex, setDurationIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(interval?.name ?? intervalStepName(0));
    setSteps(interval?.steps.length ? interval.steps : [newStep(0)]);
    setDurationIndex(null);
  }, [isOpen, interval]);

  const addStep = () => {
    if (steps.length >= MAX_INTERVAL_STEPS) return;
    setSteps((prev) => [...prev, newStep(prev.length)]);
  };

  const updateStep = (id: string, updates: Partial<IntervalStep>) => {
    setSteps((prev) => prev.map((st) => (st.id === id ? { ...st, ...updates } : st)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((st) => st.id !== id)));
  };

  const save = () => {
    const clean = steps.map((st, i) => ({
      ...st,
      name: st.name.trim() || intervalStepName(i),
      minutes: Math.max(1, st.minutes),
    }));
    onSave({
      id: interval?.id ?? `iv-${Date.now()}`,
      name: name.trim() || clean[0]?.name || intervalStepName(0),
      steps: clean.slice(0, MAX_INTERVAL_STEPS),
    });
    onClose();
  };

  const durationStep = durationIndex !== null ? steps[durationIndex] ?? null : null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[10001] flex items-center justify-center" onClick={onClose}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-3xl z-[10002] flex flex-col shadow-[0_12px_40px_rgba(0,0,0,0.15)] mx-5"
              style={{ width: 'min(340px, 90vw)', maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-1 flex items-center justify-between shrink-0">
                <span className="text-[16px] font-bold text-[#333]">{interval ? 'Editar intervalo' : 'Nuevo intervalo'}</span>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f7f6f9] border-none cursor-pointer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-5 pt-2 overflow-y-auto no-scrollbar">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del intervalo"
                  className="w-full border border-[#e4e4ed] rounded-xl py-2.5 px-3.5 text-[15px] text-[#333] bg-[#fafafc] outline-none focus:border-[#7f70ff] focus:bg-white transition-colors mb-2"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-[#555]">Intervalos</span>
                  <span className="text-[12px] text-[#aaa] tabular-nums">{steps.length}/{MAX_INTERVAL_STEPS}</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {steps.map((st, i) => (
                    <div key={st.id} className="flex items-center gap-1.5">
                      <input
                        value={st.name}
                        onChange={(e) => updateStep(st.id, { name: e.target.value })}
                        placeholder={intervalStepName(i)}
                        className="flex-1 min-w-0 border border-[#e4e4ed] rounded-lg py-2 px-2.5 text-[14px] text-[#333] bg-[#fafafc] outline-none focus:border-[#7f70ff] focus:bg-white transition-colors"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateStep(st.id, { minutes: Math.max(1, st.minutes - 1) })}
                          aria-label="Quitar un minuto"
                          className="w-7 h-7 rounded-full bg-[#f7f6f9] border-none cursor-pointer flex items-center justify-center text-[#7f70ff] active:scale-90 transition-transform"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDurationIndex(i)}
                          aria-label="Elegir duración"
                          className="text-[13px] font-semibold text-[#333] tabular-nums w-[46px] text-center bg-transparent border-none cursor-pointer"
                        >
                          {st.minutes} min
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStep(st.id, { minutes: Math.min(24 * 60, st.minutes + 1) })}
                          aria-label="Añadir un minuto"
                          className="w-7 h-7 rounded-full bg-[#f7f6f9] border-none cursor-pointer flex items-center justify-center text-[#7f70ff] active:scale-90 transition-transform"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(st.id)}
                        disabled={steps.length <= 1}
                        aria-label="Eliminar intervalo"
                        className="w-7 h-7 rounded-full bg-[#fff1f3] border-none cursor-pointer flex items-center justify-center text-[#ff6b81] shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                {steps.length < MAX_INTERVAL_STEPS && (
                  <button
                    type="button"
                    onClick={addStep}
                    className="mt-2 w-full py-2 rounded-xl border border-dashed border-[#c9c2f0] bg-transparent text-[13px] font-semibold text-[#7f70ff] cursor-pointer"
                  >
                    + Añadir intervalo
                  </button>
                )}
              </div>

              <div className="px-5 pb-5 pt-3 flex gap-2 shrink-0">
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
        )}
      </AnimatePresence>

      <CustomDurationModal
        isOpen={durationStep !== null}
        title={durationStep ? `Duración · ${durationStep.name || intervalStepName(durationIndex ?? 0)}` : 'Duración'}
        initialMinutes={durationStep?.minutes ?? 5}
        onClose={() => setDurationIndex(null)}
        onSave={(h, m) => {
          if (durationStep) updateStep(durationStep.id, { minutes: Math.max(1, h * 60 + m) });
          setDurationIndex(null);
        }}
      />
    </>
  );
}
