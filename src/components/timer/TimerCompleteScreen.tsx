import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { formatElapsed } from '../../hooks/useTimeTracker';
import { startAlarm, type AlarmSoundId } from '../../utils/alarm';

interface Props {
  /** Duración configurada del temporizador, en segundos. */
  targetSeconds: number;
  /** Momento (ms) en que se terminó la cuenta: desde ahí cuenta el tiempo extra. */
  finishedAt: number;
  onSilence: () => void;
  soundEnabled: boolean;
  sound: AlarmSoundId;
  vibrate: boolean;
}

/** "+1:05" para el tiempo extra sobre la cuenta configurada. */
function formatExtra(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Pantalla de temporizador completado: suena la alarma hasta que el usuario la
 * silencia y el tiempo registrado incluye esa espera.
 */
export function TimerCompleteScreen({ targetSeconds, finishedAt, onSilence, soundEnabled, sound, vibrate }: Props) {
  useBackHandler(true, onSilence);
  const [now, setNow] = useState(() => Date.now());

  // La alarma suena en bucle mientras esta pantalla está montada.
  useEffect(() => {
    const stop = startAlarm({ sound: soundEnabled ? sound : null, vibrate });
    return stop;
  }, [sound, soundEnabled, vibrate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const extraSeconds = Math.max(0, Math.floor((now - finishedAt) / 1000));
  const totalSeconds = targetSeconds + extraSeconds;

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

      <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#1c1c23] m-0 text-center">Temporizador completado</h1>
      <p className="text-[13px] text-[#8b8b98] mt-1.5 mb-0 text-center">Silencia la alarma para guardar la sesión</p>

      <div className="mt-8 flex flex-col items-center">
        <span className="eyebrow">Tiempo registrado</span>
        <span className="text-[40px] font-bold tabular-nums tracking-[-0.04em] text-[#1c1c23] leading-none mt-2">{formatElapsed(totalSeconds)}</span>
        <span className="mt-3 text-[13px] text-[#777]">
          {formatElapsed(targetSeconds)} de temporizador
          <span className="text-[#7f70ff] font-semibold"> · +{formatExtra(extraSeconds)}</span>
        </span>
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
