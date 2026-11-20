import { Fragment, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { formatElapsed } from '../../hooks/useTimeTracker';
import { startAlarm, type AlarmSoundId } from '../../utils/alarm';

interface Props {
  /** Tiempo de enfoque acumulado en todo el pomodoro, en segundos. */
  focusSeconds: number;
  /** Sesiones de enfoque completadas y totales del ciclo. */
  sessionsDone: number;
  sessionsTotal: number;
  onSilence: () => void;
  soundEnabled: boolean;
  sound: AlarmSoundId;
  vibrate: boolean;
}

/**
 * Alarma final del pomodoro: suena hasta que el usuario la silencia y solo
 * entonces se guarda la sesión.
 */
export function PomodoroCompleteScreen({ focusSeconds, sessionsDone, sessionsTotal, onSilence, soundEnabled, sound, vibrate }: Props) {
  useBackHandler(true, onSilence);

  useEffect(() => {
    const stop = startAlarm({ sound: soundEnabled ? sound : null, vibrate });
    return stop;
  }, [sound, soundEnabled, vibrate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[10050] flex flex-col items-center justify-center px-6 bg-white"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
    >
      {/* Campana con ondas */}
      <div className="relative flex items-center justify-center mb-8">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ width: 96, height: 96, border: '2px solid rgba(127,112,255,0.35)' }}
            animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-[96px] h-[96px] rounded-full bg-gradient-to-br from-[#7f70ff] to-[#9d8aff] flex items-center justify-center shadow-[0_10px_30px_rgba(127,112,255,0.35)]"
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        </motion.div>
      </div>

      <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#1c1c23] m-0 text-center">Pomodoro completado</h1>
      <p className="text-[13px] text-[#8b8b98] mt-1.5 mb-0 text-center">Silencia la alarma para guardar la sesión</p>

      <div className="mt-8 flex flex-col items-center">
        <span className="eyebrow">Tiempo de enfoque</span>
        <span className="text-[40px] font-bold tabular-nums tracking-[-0.04em] text-[#1c1c23] leading-none mt-2">{formatElapsed(focusSeconds)}</span>

        {/* Sesiones completadas */}
        <div className="mt-5 flex items-center gap-1.5">
          {Array.from({ length: Math.max(sessionsTotal, sessionsDone) }).map((_, i) => {
            const done = i < sessionsDone;
            return (
              <Fragment key={i}>
                {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-[#cfcbe0]" />}
                <span className="rounded-full" style={{ width: 18, height: 4, background: done ? '#7f70ff' : '#e6e3f0' }} />
              </Fragment>
            );
          })}
        </div>
        <span className="mt-2.5 text-[13px] text-[#777]">{sessionsDone} de {sessionsTotal} sesiones de enfoque</span>
      </div>

      <button
        onClick={onSilence}
        className="mt-10 w-full max-w-[320px] py-4 rounded-2xl bg-gradient-to-br from-[#7f70ff] to-[#9d8aff] text-white text-[16px] font-semibold border-none cursor-pointer shadow-[0_8px_20px_rgba(127,112,255,0.32)] active:scale-[0.98] transition-transform"
      >
        Silenciar y guardar
      </button>
    </motion.div>
  );
}
