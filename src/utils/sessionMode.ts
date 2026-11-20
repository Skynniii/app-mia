import type { TimerMode } from '../types';

/** Nombre visible del modo con el que se registró una sesión. */
export const SESSION_MODE_LABELS: Record<TimerMode, string> = {
  stopwatch: 'Rastreador',
  timer: 'Temporizador',
  pomodoro: 'Pomodoro',
  interval: 'Intervalo',
};

export function sessionModeLabel(mode?: TimerMode): string {
  return (mode && SESSION_MODE_LABELS[mode]) || '';
}
