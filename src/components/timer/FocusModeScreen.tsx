import { motion } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { useWakeLock } from '../../hooks/useWakeLock';
import { FocusRing } from './FocusRing';
import type { FocusTheme } from '../../hooks/useTimerSettings';

interface Props {
  theme: FocusTheme;
  timeDisplay: string;
  progress: number;
  color: string;
  /** Descripción de la actividad, si la hay. */
  title: string;
  isRunning: boolean;
  keepScreenOn: boolean;
  onToggle: () => void;
  onFinish: () => void;
  onSkip?: () => void;
  onExit: () => void;
}

const KEYFRAMES = `
@keyframes focus-orb-a{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(70px,50px,0) scale(1.18)}}
@keyframes focus-orb-b{0%,100%{transform:translate3d(0,0,0) scale(1.12)}50%{transform:translate3d(-60px,-70px,0) scale(0.92)}}
@keyframes focus-wave{0%{transform:scale(0.62);opacity:0}18%{opacity:0.45}100%{transform:scale(2.15);opacity:0}}
@keyframes focus-breath{0%,100%{opacity:0.35;transform:scale(1)}50%{opacity:0.7;transform:scale(1.06)}}
.anim-focus-orb-a{animation:focus-orb-a 16s ease-in-out infinite;will-change:transform}
.anim-focus-orb-b{animation:focus-orb-b 20s ease-in-out infinite;will-change:transform}
.anim-focus-wave{animation:focus-wave 6s ease-out infinite;will-change:transform,opacity}
.anim-focus-breath{animation:focus-breath 5s ease-in-out infinite;will-change:opacity,transform}
`;

const THEME_BACKGROUND: Record<FocusTheme, string> = {
  anillo: '#fbfaff',
  numeros: '#000000',
  onda: 'linear-gradient(165deg,#170f26 0%,#241433 55%,#0f0a18 100%)',
};

/** Pantalla del modo concentración: solo el reloj, la actividad y lo esencial. */
export function FocusModeScreen({ theme, timeDisplay, progress, color, title, isRunning, keepScreenOn, onToggle, onFinish, onSkip, onExit }: Props) {
  useBackHandler(true, onExit);
  useWakeLock(keepScreenOn);

  const dark = theme !== 'anillo';
  const softButton = dark
    ? 'bg-white/[0.06] text-white/35'
    : 'bg-[#f1eff7] text-[#b6b2c4]';
  const mainButton = dark
    ? 'bg-white/10 text-white/80'
    : 'bg-[#e9e6f4] text-[#8b85a3]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-[10040] flex flex-col overflow-hidden"
      style={{ background: THEME_BACKGROUND[theme] }}
    >
      <style>{KEYFRAMES}</style>

      {/* Fondos animados */}
      {theme === 'anillo' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[340px] h-[340px] rounded-full anim-focus-breath blur-[70px]" style={{ background: `${color}22` }} />
        </div>
      )}
      {theme === 'numeros' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[15%] -left-[25%] w-[420px] h-[420px] rounded-full blur-[90px] anim-focus-orb-a" style={{ background: '#3b2bff', opacity: 0.3 }} />
          <div className="absolute -bottom-[10%] -right-[20%] w-[380px] h-[380px] rounded-full blur-[90px] anim-focus-orb-b" style={{ background: '#8a2be2', opacity: 0.22 }} />
        </div>
      )}
      {theme === 'onda' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute w-[220px] h-[220px] rounded-full border anim-focus-wave"
              style={{ borderColor: `${color}33`, animationDelay: `${i * 1.5}s` }}
            />
          ))}
        </div>
      )}

      {/* Contenido */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6">
        {theme === 'anillo' && (
          <>
            <FocusRing progress={progress} color={color} size={260} stroke={5} trackColor="#eceaf3" shimmer={isRunning}>
              <span className="text-[46px] font-light text-[#2c2a36] tabular-nums tracking-[-0.03em] leading-none">{timeDisplay}</span>
            </FocusRing>
            {title && (
              <p className="mt-9 mb-0 max-w-[260px] truncate text-[13px] uppercase tracking-[0.16em] text-[#a8a4b6] text-center">{title}</p>
            )}
          </>
        )}

        {theme === 'numeros' && (
          <div className="flex flex-col items-center">
            <span
              className={`w-1.5 h-1.5 rounded-full mb-10 ${isRunning ? 'anim-dot-pulse' : ''}`}
              style={{ background: isRunning ? color : 'rgba(255,255,255,0.25)' }}
            />
            <span className="text-[76px] font-thin text-white tabular-nums tracking-[-0.05em] leading-none">{timeDisplay}</span>
          </div>
        )}

        {theme === 'onda' && (
          <div className="flex flex-col items-center">
            <span className="text-[58px] font-light text-white/90 tabular-nums tracking-[-0.04em] leading-none">{timeDisplay}</span>
            {title && (
              <span className="mt-6 max-w-[240px] truncate text-[12px] uppercase tracking-[0.24em] text-white/35">{title}</span>
            )}
          </div>
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
