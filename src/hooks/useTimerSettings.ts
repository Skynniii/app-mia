import { useMemo } from 'react';
import { useUserStorage } from './useUserStorage';

/** Intervalo personalizado del modo "Intervalos". */
export interface CustomInterval {
  id: string;
  name: string;
  /** Minutos de enfoque por ronda. */
  focusMin: number;
  /** Minutos de descanso entre rondas. */
  restMin: number;
  /** Cuántas rondas de enfoque tiene el intervalo. */
  rounds: number;
}

export interface TimerSettings {
  pomodoroFocus: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  /** Cada cuántas sesiones de enfoque toca el descanso largo. */
  pomodoroLongBreakEvery: number;
  /** Últimas duraciones usadas en el temporizador (minutos, distintas). */
  recentDurations: number[];
  intervals: CustomInterval[];
}

export const TIMER_SETTINGS_DEFAULTS: TimerSettings = {
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroLongBreakEvery: 4,
  recentDurations: [],
  intervals: [],
};

/** Duraciones sugeridas cuando todavía no hay ninguna registrada. */
const DEFAULT_DURATIONS = [5, 10, 30, 45, 60];

/**
 * Ajustes del Timer (pomodoro e intervalos). Viven en el documento del usuario,
 * así que se sincronizan entre dispositivos y los comparten la pantalla de Focus
 * y su pantalla de configuración.
 */
export function useTimerSettings() {
  const [stored, setStored] = useUserStorage<TimerSettings>('timer-settings', TIMER_SETTINGS_DEFAULTS);
  // Los ajustes guardados pueden no tener las claves nuevas: se completan con los valores por defecto.
  const timerSettings = useMemo<TimerSettings>(() => ({ ...TIMER_SETTINGS_DEFAULTS, ...stored }), [stored]);

  const update = <K extends keyof TimerSettings>(key: K, value: TimerSettings[K]) =>
    setStored((prev) => ({ ...TIMER_SETTINGS_DEFAULTS, ...prev, [key]: value }));

  return { timerSettings, updateTimerSettings: update };
}

/** Hasta 5 duraciones recientes distintas, completadas con las sugeridas. */
export function recentDurationsOf(timerSettings: TimerSettings): number[] {
  const used = timerSettings.recentDurations.filter((m) => m > 0);
  return [...used, ...DEFAULT_DURATIONS.filter((d) => !used.includes(d))].slice(0, 5);
}
