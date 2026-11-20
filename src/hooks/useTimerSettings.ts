import { useMemo } from 'react';
import { useUserStorage } from './useUserStorage';
import type { AlarmSoundId } from '../utils/alarm';

/** Intervalo extra dentro de un intervalo propio (máximo 5). */
export interface IntervalExtra {
  id: string;
  name: string;
  /** Minutos que dura el intervalo extra. */
  minutes: number;
}

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
  /** Intervalos propios que se añaden tras el descanso de cada ronda. */
  extras: IntervalExtra[];
}

/** Máximo de intervalos extra que admite un intervalo propio. */
export const MAX_INTERVAL_EXTRAS = 5;

/** Tema visual del modo concentración. */
export type FocusTheme = 'anillo' | 'numeros';

/** Fondo claro u oscuro del modo concentración. */
export type FocusAppearance = 'light' | 'dark';

export const FOCUS_THEMES: { id: FocusTheme; name: string; hint: string }[] = [
  { id: 'anillo', name: 'Anillo', hint: 'Reloj y aro' },
  { id: 'numeros', name: 'Números', hint: 'Cifras grandes' },
];

export const FOCUS_APPEARANCES: { id: FocusAppearance; name: string }[] = [
  { id: 'light', name: 'Clara' },
  { id: 'dark', name: 'Oscura' },
];

/** Minutos que suman o restan los botones − / + del temporizador. */
export const TIMER_ADJUST_OPTIONS = [1, 2, 5, 10];

export interface TimerSettings {
  pomodoroFocus: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  /** Cada cuántas sesiones de enfoque toca el descanso largo. */
  pomodoroLongBreakEvery: number;
  /** Inicia sola la siguiente sesión (enfoque o descanso) con un aviso sonoro. */
  pomodoroAutoStart: boolean;
  /** Sonido de la alarma que suena al completar el pomodoro. */
  pomodoroAlarmSound: AlarmSoundId;
  /** Últimas duraciones usadas en el temporizador (minutos, distintas). */
  recentDurations: number[];
  /** Minutos que suman o restan los botones − / + del temporizador. */
  timerAdjustMinutes: number;
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
  /** Fondo claro u oscuro del modo concentración. */
  focusAppearance: FocusAppearance;
}

export const TIMER_SETTINGS_DEFAULTS: TimerSettings = {
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroLongBreakEvery: 4,
  pomodoroAutoStart: true,
  pomodoroAlarmSound: 'suave',
  recentDurations: [],
  timerAdjustMinutes: 1,
  intervals: [],
  timerAlarmSound: 'campana',
  timerAlarmVibrate: true,
  startInFocusMode: false,
  keepScreenOn: true,
  focusTheme: 'anillo',
  focusAppearance: 'light',
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
  // Los ajustes guardados pueden no tener las claves nuevas (o venir del tema
  // "onda", ya retirado): se completan y se normalizan con los valores actuales.
  const timerSettings = useMemo<TimerSettings>(() => {
    const merged = { ...TIMER_SETTINGS_DEFAULTS, ...stored };
    return {
      ...merged,
      focusTheme: merged.focusTheme === 'numeros' ? 'numeros' : 'anillo',
      focusAppearance: merged.focusAppearance === 'dark' ? 'dark' : 'light',
      intervals: (merged.intervals ?? []).map((iv) => ({ ...iv, extras: iv.extras ?? [] })),
    };
  }, [stored]);

  const update = <K extends keyof TimerSettings>(key: K, value: TimerSettings[K]) =>
    setStored((prev) => ({ ...TIMER_SETTINGS_DEFAULTS, ...prev, [key]: value }));

  return { timerSettings, updateTimerSettings: update };
}

/** Las 4 duraciones recientes distintas, completadas con las sugeridas. */
export function recentDurationsOf(timerSettings: TimerSettings): number[] {
  const used = timerSettings.recentDurations.filter((m) => m > 0);
  return [...used, ...DEFAULT_DURATIONS.filter((d) => !used.includes(d))].slice(0, 4);
}
