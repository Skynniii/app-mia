/**
 * Alarma del temporizador. Los sonidos se sintetizan con WebAudio (no hay
 * archivos de audio en el proyecto) y se repiten en bucle hasta que el usuario
 * la silencia desde la pantalla de completado.
 */

export type AlarmSoundId = 'campana' | 'digital' | 'pulso' | 'suave';

export const ALARM_SOUNDS: { id: AlarmSoundId; name: string; hint: string }[] = [
  { id: 'campana', name: 'Campana', hint: 'Repique cálido y profundo' },
  { id: 'digital', name: 'Digital', hint: 'Pitidos rápidos de reloj' },
  { id: 'pulso', name: 'Pulso', hint: 'Tono grave que sube' },
  { id: 'suave', name: 'Suave', hint: 'Arpegio delicado' },
];

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Desbloquea el audio en el gesto de iniciar (los móviles bloquean el sonido sin interacción). */
export function primeAlarmAudio() {
  getCtx();
}

interface Note {
  freq: number;
  /** Segundos desde el inicio del patrón. */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const PATTERNS: Record<AlarmSoundId, { period: number; notes: Note[]; vibrate: number[] }> = {
  campana: {
    period: 1700,
    notes: [
      { freq: 880, at: 0, dur: 1.1, gain: 0.22 },
      { freq: 1318.5, at: 0.18, dur: 1, gain: 0.13 },
      { freq: 1760, at: 0.34, dur: 0.7, gain: 0.06 },
    ],
    vibrate: [220, 320, 220, 900],
  },
  digital: {
    period: 1400,
    notes: [
      { freq: 1244, at: 0, dur: 0.1, type: 'square', gain: 0.09 },
      { freq: 1244, at: 0.16, dur: 0.1, type: 'square', gain: 0.09 },
      { freq: 1244, at: 0.32, dur: 0.12, type: 'square', gain: 0.09 },
    ],
    vibrate: [80, 120, 80, 120, 80, 900],
  },
  pulso: {
    period: 1900,
    notes: [
      { freq: 392, at: 0, dur: 0.5, type: 'triangle', gain: 0.2 },
      { freq: 523.25, at: 0.34, dur: 0.55, type: 'triangle', gain: 0.17 },
      { freq: 659.25, at: 0.72, dur: 0.6, type: 'triangle', gain: 0.13 },
    ],
    vibrate: [300, 200, 300, 1100],
  },
  suave: {
    period: 2300,
    notes: [
      { freq: 523.25, at: 0, dur: 0.6, gain: 0.16 },
      { freq: 659.25, at: 0.16, dur: 0.6, gain: 0.13 },
      { freq: 783.99, at: 0.32, dur: 0.6, gain: 0.12 },
      { freq: 1046.5, at: 0.48, dur: 0.9, gain: 0.09 },
    ],
    vibrate: [120, 180, 120, 1400],
  },
};

/** Avisos cortos al cambiar de sesión en el pomodoro. */
export type PhaseSoundKind = 'focus' | 'break' | 'longBreak';

const PHASE_PATTERNS: Record<PhaseSoundKind, Note[]> = {
  focus: [
    { freq: 587.33, at: 0, dur: 0.18, gain: 0.16 },
    { freq: 880, at: 0.1, dur: 0.3, gain: 0.14 },
  ],
  break: [
    { freq: 659.25, at: 0, dur: 0.2, type: 'triangle', gain: 0.15 },
    { freq: 493.88, at: 0.11, dur: 0.3, type: 'triangle', gain: 0.13 },
  ],
  longBreak: [
    { freq: 523.25, at: 0, dur: 0.16, gain: 0.13 },
    { freq: 659.25, at: 0.09, dur: 0.16, gain: 0.13 },
    { freq: 987.77, at: 0.18, dur: 0.34, gain: 0.1 },
  ],
};

function playNotes(audio: AudioContext, notes: Note[]) {
  const t0 = audio.currentTime + 0.02;

  notes.forEach((n) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    osc.connect(gain);
    gain.connect(audio.destination);

    const start = t0 + n.at;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(n.gain ?? 0.15, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + n.dur);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  });
}

function playPattern(sound: AlarmSoundId) {
  const audio = getCtx();
  if (!audio) return;
  playNotes(audio, PATTERNS[sound].notes);
}

/** Una pasada del sonido, para la vista previa de los ajustes. */
export function playAlarmPreview(sound: AlarmSoundId) {
  playPattern(sound);
}

/** Aviso corto que indica el inicio de la siguiente sesión del pomodoro. */
export function playPhaseSound(kind: PhaseSoundKind) {
  const audio = getCtx();
  if (!audio) return;
  playNotes(audio, PHASE_PATTERNS[kind]);
}

/**
 * Arranca la alarma en bucle. Devuelve la función que la detiene.
 * `sound: null` deja la alarma solo con vibración (cuando los sonidos están apagados).
 */
export function startAlarm({ sound, vibrate }: { sound: AlarmSoundId | null; vibrate: boolean }): () => void {
  const pattern = PATTERNS[sound ?? 'campana'];

  const tick = () => {
    if (sound) playPattern(sound);
    if (vibrate) {
      try { navigator.vibrate?.(pattern.vibrate); } catch { /* no crítico */ }
    }
  };

  tick();
  const timer = window.setInterval(tick, pattern.period);

  return () => {
    window.clearInterval(timer);
    try { navigator.vibrate?.(0); } catch { /* no crítico */ }
  };
}
