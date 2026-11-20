import type { TimerMode } from '../../types';
import { sessionModeLabel } from '../../utils/sessionMode';

interface Props {
  mode?: TimerMode;
  size?: number;
  className?: string;
}

/** Ícono del modo con el que se registró una sesión (uno por modo). */
export function SessionModeIcon({ mode, size = 14, className = '' }: Props) {
  if (!mode) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-label={sessionModeLabel(mode)}
      role="img"
    >
      {mode === 'stopwatch' && (
        <>
          <circle cx="12" cy="14" r="7" />
          <path d="M12 11v3l2 1.5" />
          <path d="M9.5 2h5" />
          <path d="M12 2v5" />
        </>
      )}
      {mode === 'timer' && (
        <>
          <path d="M5 22h14" />
          <path d="M5 2h14" />
          <path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4A2 2 0 0 0 7 17.8V22" />
          <path d="M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2" />
        </>
      )}
      {mode === 'pomodoro' && (
        <>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </>
      )}
      {mode === 'interval' && (
        <>
          <rect x="3" y="5" width="18" height="5" rx="2.5" />
          <rect x="3" y="14" width="11" height="5" rx="2.5" />
        </>
      )}
    </svg>
  );
}
