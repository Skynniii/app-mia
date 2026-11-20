import { useMemo } from 'react';
import { useUserStorage } from './useUserStorage';
import type { AlarmSoundId } from '../utils/alarm';

/** Paso de un intervalo: nombre propio y minutos. */
export interface IntervalStep {
  id: string;
  name: string;
  /** Minutos que dura el paso. */
  minutes: number;
}

/** Secuencia de intervalos creada por el usuario. */
export interface CustomInterval {
  id: string;
  name: string;
  /** Pasos en orden; se reproducen uno detrás de otro. */
  steps: IntervalStep[];
}

/** Máximo de pasos que admite un intervalo. */
export const MAX_INTERVAL_STEPS = 10;

/** Nombre por defecto del paso número `index` (0-based). */
export function intervalStepName(index: number): string {
  return `Intervalo ${index + 1}`;
}

/** Ajustes guardados antiguos (enfoque/descanso/rondas/extra) → pasos. */
function normalizeInterval(raw: Partial<CustomInterval> & {
  focusMin?: number; restMin?: number; rounds?: number;
  extras?: { id: string; name: string; minutes: number }[];
}): CustomInterval {
  if (Array.isArray(raw.steps) && raw.steps.length > 0) {
    return {
      id: raw.id ?? `iv-${Date.now()}`,
      name: raw.name || intervalStepName(0),
      steps: raw.steps.slice(0, MAX_INTERVAL_STEPS).map((st, i) => ({
        id: st.id ?? `st-${i}`,
        name: st.name || intervalStepName(i),
        minutes: Math.max(1, st.minutes ?? 5),
      })),
    };
  }
  const steps: IntervalStep[] = [];
  const rounds = Math.max(1, raw.rounds ?? 1);
  for (let r = 0; r < rounds; r++) {
    steps.push({ id: `st-f${r}`, name: intervalStepName(steps.length), minutes: Math.max(1, raw.focusMin ?? 25) });
    if (r < rounds - 1) {
      steps.push({ id: `st-r${r}`, minutes: Math.max(1, raw.restMin ?? 5), name: intervalStepName(steps.length) });
      (raw.extras ?? []).forEach((ex) => {
        steps.push({ id: `ex-${ex.id}-${r}`, name: ex.name || intervalStepName(steps.length), minutes: ex.minutes ?? 5 });
      });
    }
  }
  return {
    id: raw.id ?? `iv-${Date.now()}`,
    name: raw.name || intervalStepName(0),
    steps: [{ id: `st-${Date.now()}`, name: intervalStepName(0), minutes: 5 }],
  };
}

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
      intervals: (merged.intervals ?? []).map(normalizeInterval),
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
