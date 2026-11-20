import { useMemo } from 'react';
import { useUserStorage } from './useUserStorage';
import type { AlarmSoundId } from '../utils/alarm';

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

/** Tema visual del modo concentración. */
export type FocusTheme = 'anillo' | 'numeros' | 'onda';

export const FOCUS_THEMES: { id: FocusTheme; name: string; hint: string }[] = [
  { id: 'anillo', name: 'Anillo', hint: 'Reloj y aro' },
  { id: 'numeros', name: 'Números', hint: 'Negro y luz' },
  { id: 'onda', name: 'Onda', hint: 'Ondas suaves' },
];

export interface TimerSettings {
  pomodoroFocus: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  /** Cada cuántas sesiones de enfoque toca el descanso largo. */
  pomodoroLongBreakEvery: number;
  /** Últimas duraciones usadas en el temporizador (minutos, distintas). */
  recentDurations: number[];
  intervals: CustomInterval[];
  /** Sonido de la alarma que suena al terminar el temporizador. */
  timerAlarmSound: AlarmSoundId;
  /** Vibra junto con la alarma del temporizador. */
  timerAlarmVibrate: boolean;
  /** Abre el modo concentración al iniciar cualquier timer. */
  startInFocusMode: boolean;
  /** Mantiene la pantalla encendida mientras dura el modo concentración. */
  keepScreenOn: boolean;
  /** Tema del modo concentración. */
  focusTheme: FocusTheme;
}

export const TIMER_SETTINGS_DEFAULTS: TimerSettings = {
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroLongBreakEvery: 4,
  recentDurations: [],
  intervals: [],
  timerAlarmSound: 'campana',
  timerAlarmVibrate: true,
  startInFocusMode: false,
  keepScreenOn: true,
  focusTheme: 'anillo',
};

/** Duraciones sugeridas cuando todavía no hay ninguna registrada. */
const DEFAULT_DURATIONS = [5, 10, 30, 60];

/**
 * Ajustes del Timer (temporizador, pomodoro, intervalos y concentración). Viven
 * en el documento del usuario, así que se sincronizan entre dispositivos y los
 * comparten la pantalla de Focus y su pantalla de configuración.
 */
export function useTimerSettings() {
  const [stored, setStored] = useUserStorage<TimerSettings>('timer-settings', TIMER_SETTINGS_DEFAULTS);
  // Los ajustes guardados pueden no tener las claves nuevas: se completan con los valores por defecto.
  const timerSettings = useMemo<TimerSettings>(() => ({ ...TIMER_SETTINGS_DEFAULTS, ...stored }), [stored]);

  const update = <K extends keyof TimerSettings>(key: K, value: TimerSettings[K]) =>
    setStored((prev) => ({ ...TIMER_SETTINGS_DEFAULTS, ...prev, [key]: value }));

  return { timerSettings, updateTimerSettings: update };
}

/** Las 4 duraciones recientes distintas, completadas con las sugeridas. */
export function recentDurationsOf(timerSettings: TimerSettings): number[] {
  const used = timerSettings.recentDurations.filter((m) => m > 0);
  return [...used, ...DEFAULT_DURATIONS.filter((d) => !used.includes(d))].slice(0, 4);
}
