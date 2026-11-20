import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { useWakeLock } from '../../hooks/useWakeLock';
import { FocusRing } from './FocusRing';
import type { FocusAppearance, FocusTheme } from '../../hooks/useTimerSettings';

interface Props {
  theme: FocusTheme;
  appearance: FocusAppearance;
  timeDisplay: string;
  progress: number;
  color: string;
  /** Nombre de la actividad, arriba del reloj. */
  activityName?: string;
  /** Descripción de la sesión, debajo del reloj. */
  description?: string;
  isRunning: boolean;
  keepScreenOn: boolean;
  /** Fases en curso: minutos de cada una y en cuál va. */
  bars?: { weights: number[]; active: number; activeProgress: number } | null;
  onToggle: () => void;
  onFinish: () => void;
  onSkip?: () => void;
  onExit: () => void;
}

const KEYFRAMES = `
@keyframes focus-orb-a{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(70px,50px,0) scale(1.18)}}
@keyframes focus-orb-b{0%,100%{transform:translate3d(0,0,0) scale(1.12)}50%{transform:translate3d(-60px,-70px,0) scale(0.92)}}
@keyframes focus-breath{0%,100%{opacity:0.35;transform:scale(1)}50%{opacity:0.7;transform:scale(1.06)}}
.anim-focus-orb-a{animation:focus-orb-a 16s ease-in-out infinite;will-change:transform}
.anim-focus-orb-b{animation:focus-orb-b 20s ease-in-out infinite;will-change:transform}
.anim-focus-breath{animation:focus-breath 5s ease-in-out infinite;will-change:opacity,transform}
`;

/** "HH:MM:SS" → "MM:SS" cuando no hay horas, o "H:MM:SS" cuando las hay. */
function compactTime(time: string): string {
  const parts = time.split(':');
  if (parts.length < 3) return time;
  const [h, m, s] = parts;
  return h === '00' ? `${m}:${s}` : `${Number(h)}:${m}:${s}`;
}

/** Pantalla del modo concentración: actividad, reloj y lo esencial. */
export function FocusModeScreen({ theme, appearance, timeDisplay, progress, color, activityName, description, isRunning, keepScreenOn, bars, onToggle, onFinish, onSkip, onExit }: Props) {
  useBackHandler(true, onExit);
  useWakeLock(keepScreenOn);

  const dark = appearance === 'dark';
  const background = dark ? '#000000' : '#fbfaff';
  const ink = dark ? '#ffffff' : '#1c1c23';
  const muted = dark ? 'rgba(255,255,255,0.42)' : '#a8a4b6';
  const track = dark ? 'rgba(255,255,255,0.1)' : '#eceaf3';
  const softButton = dark ? 'bg-white/[0.06] text-white/35' : 'bg-[#f1eff7] text-[#b6b2c4]';
  const mainButton = dark ? 'bg-white/10 text-white/80' : 'bg-[#e9e6f4] text-[#8b85a3]';
  const panelBg = dark ? '#151519' : '#ffffff';

  const compact = compactTime(timeDisplay);
  const groups = compact.split(':');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-[10040] flex flex-col overflow-hidden"
      style={{ background }}
    >
      <style>{KEYFRAMES}</style>

      {/* Fondos animados */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-[12%] -left-[20%] w-[400px] h-[400px] rounded-full blur-[90px] anim-focus-orb-a"
          style={{ background: color, opacity: dark ? 0.16 : 0.1 }}
        />
        <div
          className="absolute -bottom-[12%] -right-[20%] w-[360px] h-[360px] rounded-full blur-[90px] anim-focus-orb-b"
          style={{ background: '#8a2be2', opacity: dark ? 0.14 : 0.07 }}
        />
      </div>

      {/* Contenido */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4">
        {/* Actividad, arriba del reloj */}
        {activityName && (
          <span
            className="flex items-center gap-2 mb-7 max-w-[300px] rounded-full px-3.5 py-1.5 text-[13px] font-semibold tracking-[-0.01em]"
            style={{ color: ink, background: dark ? 'rgba(255,255,255,0.07)' : '#ffffff', boxShadow: dark ? 'none' : '0 6px 18px rgba(28,28,35,0.06)' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="truncate">{activityName}</span>
          </span>
        )}

        {theme === 'anillo' ? (
          <div className="relative flex items-center justify-center">
            {!dark && (
              <div className="absolute w-[320px] h-[320px] rounded-full anim-focus-breath blur-[70px]" style={{ background: `${color}1f` }} />
            )}
            <FocusRing progress={progress} color={color} size={280} stroke={6} trackColor={track} shimmer={isRunning}>
              <span className="font-light tabular-nums tracking-[-0.03em] leading-none" style={{ color: ink, fontSize: 56 }}>{compact}</span>
            </FocusRing>
          </div>
        ) : (
          /* Números: grupos de cifras apilados en vertical, grandes y centrados */
          <div className="flex flex-col items-center gap-1.5">
            {groups.map((g, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="w-1 h-1 rounded-full" style={{ background: muted, opacity: 0.45 }} />}
                <span
                  className="relative rounded-[22px] px-3 py-1 text-center font-light tabular-nums leading-none tracking-[-0.04em]"
                  style={{
                    background: panelBg,
                    color: ink,
                    fontSize: groups.length > 2 ? 'clamp(64px, 22vw, 112px)' : 'clamp(92px, 36vw, 156px)',
                    boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.55)' : '0 10px 26px rgba(28,28,35,0.08)',
                  }}
                >
                  {g}
                </span>
              </Fragment>
            ))}
          </div>
        )}

        {/* Fases en curso: una barrita por fase, con el ancho de su duración */}
        {bars && bars.weights.length > 0 && (
          <div className="mt-6 flex items-center gap-1.5 w-[220px]">
            {bars.weights.map((weight, i) => {
              const done = i < bars.active;
              const current = i === bars.active;
              return (
                <span
                  key={i}
                  className="relative block overflow-hidden rounded-full"
                  style={{
                    flexGrow: Math.max(1, weight),
                    flexBasis: 0,
                    height: 4,
                    background: done ? color : current ? `${color}3d` : muted,
                    opacity: done || current ? 1 : 0.3,
                  }}
                >
                  {current && (
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.round(Math.min(1, Math.max(0, bars.activeProgress)) * 100)}%`, background: color }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        )}

        {/* Descripción, debajo del reloj */}
        {description && (
          <p className="mt-7 mb-0 max-w-[280px] truncate text-[14px] font-medium tracking-[-0.01em] text-center" style={{ color: muted }}>{description}</p>
        )}
      </div>

      {/* Controles descoloridos: salir · pausa · saltar · terminar */}
      <div className="relative flex items-center justify-center gap-5 shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 40px)' }}>
        <button onClick={onExit} title="Salir del modo concentración" className={`w-[52px] h-[52px] rounded-full border-none cursor-pointer flex items-center justify-center active:scale-90 transition-transform ${softButton}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
        </button>

        <button onClick={onToggle} title={isRunning ? 'Pausar' : 'Continuar'} className={`w-[68px] h-[68px] rounded-full border-none cursor-pointer flex items-center justify-center active:scale-90 transition-transform ${mainButton}`}>
          {isRunning ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        {onSkip && (
          <button onClick={onSkip} title="Saltar fase" className={`w-[52px] h-[52px] rounded-full border-none cursor-pointer flex items-center justify-center active:scale-90 transition-transform ${softButton}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
          </button>
        )}

        <button onClick={onFinish} title="Terminar y guardar" className={`w-[52px] h-[52px] rounded-full border-none cursor-pointer flex items-center justify-center active:scale-90 transition-transform ${softButton}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
      </div>
    </motion.div>
  );
}
