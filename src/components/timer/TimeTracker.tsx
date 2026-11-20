import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { playCompleteSound } from '../../utils/sound';
import { useTimeTracker, todayKey, formatElapsed, isoToDateKey } from '../../hooks/useTimeTracker';
import { useFirestoreCollection, incrementTaskTime } from '../../hooks/useFirestoreCollection';
import { useCountdownTimer, type TimerMode } from '../../hooks/useCountdownTimer';
import { useTimerSettings, type CustomInterval } from '../../hooks/useTimerSettings';
import { useUserStorage } from '../../hooks/useUserStorage';
import { setPendingTimerTask, getPendingTimerTask, clearPendingTimerTask } from '../../shared/pendingTimerTask';
import { completeTaskAdvances } from '../../shared/advances';
import { subscribeFocusRequest } from '../../shared/focusRequest';
import { sortListsForDisplay } from '../../utils/listOrder';
import { SectionHeader } from '../ui/SectionHeader';
import { TodaySummary } from './TodaySummary';
import { FocusScreen } from './FocusScreen';
import { TimerCompleteScreen } from './TimerCompleteScreen';
import { PomodoroCompleteScreen } from './PomodoroCompleteScreen';
import { playPhaseSound } from '../../utils/alarm';
import { EntryList } from './EntryList';
import { SessionDetailModal } from './SessionDetailModal';
import type { Task, TaskList, TimerMode as AppTimerMode } from '../../types';

interface Props {
  onMenuClick: () => void;
  onOpenAccount: () => void;
}

export function TimeTracker({ onMenuClick, onOpenAccount }: Props) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const tracker = useTimeTracker();
  const countdown = useCountdownTimer();
  const { timerSettings, updateTimerSettings } = useTimerSettings();
  const [mode, setMode] = useUserStorage<TimerMode>('timer-mode', 'rastreador');
  const [pomodoroPhase, setPomodoroPhase] = useState<'work' | 'break' | 'longBreak'>('work');
  const [pomodoroCycle, setPomodoroCycle] = useState(0);
  // Tiempo de enfoque acumulado en el pomodoro en curso (segundos).
  const [pomodoroElapsed, setPomodoroElapsed] = useState(0);
  // El pomodoro se completó: suena la alarma final hasta silenciarla.
  const [pomodoroFinished, setPomodoroFinished] = useState(false);
  const [intervalRun, setIntervalRun] = useState<{ interval: CustomInterval; stepIndex: number } | null>(null);
  // Tiempo acumulado de los pasos ya completados del intervalo en curso.
  const [intervalElapsed, setIntervalElapsed] = useState(0);
  const [showFocus, setShowFocus] = useState(false);
  // Momento en que el temporizador llegó a cero: mientras no se silencie la
  // alarma, el tiempo extra se suma a la sesión.
  const [timerFinishedAt, setTimerFinishedAt] = useState<number | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const listsColl = useFirestoreCollection<TaskList>(uid, 'taskLists');
  const tasksColl = useFirestoreCollection<Task>(uid, 'tasks');
  // Mismo orden de listas que la sección de Tasks
  const taskLists = useMemo(() => sortListsForDisplay(listsColl.items), [listsColl.items]);
  const tasks = tasksColl.items;

  const selectedEntry = selectedEntryId ? tracker.sessions.find((e) => e.id === selectedEntryId) ?? null : null;

  // Escuchar botón + de la barra de navegación y timer desde tareas
  useEffect(() => {
    const addHandler = () => {
      tracker.setDraft({ activityId: '', description: '', notes: '' });
      setShowFocus(true);
    };
    window.addEventListener('app-add', addHandler);
    return () => window.removeEventListener('app-add', addHandler);
  }, [tracker.setDraft]);

  // Abrir la pantalla Focus desde otro punto de la app (por ejemplo, el check
  // de una tarea-actividad en curso en la lista de Tasks).
  useEffect(() => subscribeFocusRequest(() => setShowFocus(true)), []);

  // Manejar tarea pendiente (iniciar timer desde TaskDetailView o tarea-actividad)
  useEffect(() => {
    const pending = getPendingTimerTask();
    if (pending) {
      clearPendingTimerTask();
      const { task, avanceTaskId } = pending;
      tracker.setDraft({
        activityId: task.activityId || '', description: task.title, notes: task.notes ?? '',
        taskId: task.id, avanceTaskId: avanceTaskId ?? undefined,
      });
      setShowFocus(true);
    }
  }, [tracker.setDraft]);

  // Estado de la tarea al registrar su sesión:
  // - tarea-actividad: se quita de la lista de tareas
  // - tarea normal: sincroniza la actividad elegida y, si se completó, la marca
  // - avance: al completar la sesión, también se marca el avance
  const handleTaskAfterSession = (taskId: string | undefined, complete: boolean, avanceTaskId?: string) => {
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      // En una sesión de avance la tarea original se conserva para que acumule
      // el tiempo registrado (solo se completa el avance).
      if (task?.isActivityOnly && !avanceTaskId) {
        tasksColl.remove(taskId);
        return;
      }
      if (task && tracker.draft.activityId) tasksColl.update(taskId, { activityId: tracker.draft.activityId });
      // Si la sesión es de un avance, completar solo marca el avance: la tarea
      // original únicamente suma el tiempo registrado. Al completar la tarea
      // original se completan también todos sus avances existentes.
      if (task && complete && !avanceTaskId) {
        tasksColl.update(taskId, { completed: true, completedAt: new Date().toISOString() });
        if (uid) void completeTaskAdvances(uid, taskId);
      }
    }
    if (complete && avanceTaskId) {
      tasksColl.update(avanceTaskId, { completed: true, completedAt: new Date().toISOString() });
    }
  };

  const handleStop = async (completeTask = false, taskIdOverride?: string) => {
    const taskId = taskIdOverride ?? tracker.draft.taskId;
    const avanceTaskId = tracker.draft.avanceTaskId;
    await tracker.stop();
    if (settings.sounds) playCompleteSound();
    handleTaskAfterSession(taskId, completeTask, avanceTaskId);
    tracker.setDraft((d) => ({ ...d, taskId: undefined, avanceTaskId: undefined }));
  };

  const { setOnComplete, start: cdStart } = countdown;

  const minutesOfPhase = (phase: 'work' | 'break' | 'longBreak') =>
    phase === 'work' ? timerSettings.pomodoroFocus : phase === 'longBreak' ? timerSettings.pomodoroLongBreak : timerSettings.pomodoroBreak;

  // Arranca la siguiente sesión del pomodoro. Con el inicio automático apagado
  // deja el contador preparado y el usuario lo pone en marcha.
  const startPomodoroPhase = (phase: 'work' | 'break' | 'longBreak') => {
    if (settings.sounds) playPhaseSound(phase === 'work' ? 'focus' : phase === 'longBreak' ? 'longBreak' : 'break');
    if (timerSettings.pomodoroAutoStart) cdStart(minutesOfPhase(phase) * 60);
    else countdown.setTarget(minutesOfPhase(phase));
  };

  // Siguiente fase del pomodoro: enfoque → descanso (o largo al cerrar el ciclo).
  // `skipped` distingue un salto manual (solo cuenta el tiempo hecho) de una
  // sesión que llegó al final.
  const advancePomodoro = (skipped = false) => {
    if (pomodoroPhase === 'work') {
      const focusThisPhase = skipped ? Math.max(0, countdown.targetSeconds - countdown.remaining) : countdown.targetSeconds;
      const done = pomodoroCycle + 1;
      setPomodoroElapsed((prev) => prev + focusThisPhase);
      setPomodoroCycle(done);
      const nextPhase = done >= Math.max(1, timerSettings.pomodoroLongBreakEvery) ? 'longBreak' : 'break';
      setPomodoroPhase(nextPhase);
      startPomodoroPhase(nextPhase);
    } else if (pomodoroPhase === 'longBreak') {
      // Se cumplieron todas las sesiones: alarma final hasta que la silencie.
      setPomodoroFinished(true);
    } else {
      setPomodoroPhase('work');
      startPomodoroPhase('work');
    }
  };

  // Siguiente paso del intervalo en curso. `skipped` distingue un salto manual
  // (solo cuenta el tiempo hecho) de un paso que llegó al final.
  const advanceInterval = (skipped = false) => {
    if (!intervalRun) return;
    const { interval, stepIndex } = intervalRun;
    const steps = interval.steps;
    // Último paso: el contador se queda en 00:00 para poder guardar la sesión
    // (su tiempo lo suma el guardado, así no se cuenta dos veces).
    if (stepIndex + 1 >= steps.length) return;
    const done = skipped ? Math.max(0, countdown.targetSeconds - countdown.remaining) : countdown.targetSeconds;
    setIntervalElapsed((prev) => prev + done);
    const next = stepIndex + 1;
    setIntervalRun({ interval, stepIndex: next });
    cdStart(steps[next].minutes * 60);
  };

  // Vuelve el pomodoro a su estado inicial (enfoque, ciclo 0, sin tiempo).
  const resetPomodoro = () => {
    setPomodoroPhase('work');
    setPomodoroCycle(0);
    setPomodoroElapsed(0);
    countdown.setTarget(timerSettings.pomodoroFocus);
  };

  // El temporizador guarda un callback fijo: se lee el estado más reciente por ref.
  const phaseHandlers = useRef({ advancePomodoro, advanceInterval });
  phaseHandlers.current = { advancePomodoro, advanceInterval };

  useEffect(() => {
    setOnComplete(() => {
      // El temporizador no avanza solo: entra en la pantalla de completado con
      // la alarma sonando hasta que el usuario la silencie.
      if (mode === 'temporizador') {
        setTimerFinishedAt(Date.now());
        return;
      }
      if (settings.sounds) playCompleteSound();
      if (mode === 'pomodoro') phaseHandlers.current.advancePomodoro(false);
      else if (mode === 'intervalos') phaseHandlers.current.advanceInterval();
    });
  }, [mode, settings.sounds, setOnComplete]);

  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode);
    if (newMode === 'temporizador') countdown.setTarget(25);
    else if (newMode === 'pomodoro') { resetPomodoro(); }
    else if (newMode === 'intervalos') { setIntervalRun(null); setIntervalElapsed(0); countdown.reset(); }
  };

  const handlePomodoroSkip = () => advancePomodoro(true);

  const handleStartInterval = (interval: CustomInterval) => {
    const first = interval.steps[0];
    setIntervalElapsed(0);
    setIntervalRun({ interval, stepIndex: 0 });
    cdStart(Math.max(1, first?.minutes ?? 5) * 60);
  };

  const handleDiscard = () => {
    setTimerFinishedAt(null);
    setPomodoroFinished(false);
    if (mode === 'rastreador') tracker.discard();
    else {
      if (mode === 'pomodoro') countdown.setTarget(timerSettings.pomodoroFocus);
      else countdown.reset();
      setIntervalRun(null); setIntervalElapsed(0); setPomodoroPhase('work'); setPomodoroCycle(0); setPomodoroElapsed(0);
    }
    // Limpia taskId del draft para que no se herede en la próxima sesión
    tracker.setDraft((d) => ({ ...d, taskId: undefined, avanceTaskId: undefined }));
    setShowFocus(false);
  };

  const handleSaveSession = async (completeTask: boolean, taskId?: string) => {
    const actualTaskId = taskId ?? tracker.draft.taskId;
    const avanceTaskId = tracker.draft.avanceTaskId;
    if (mode === 'rastreador') {
      // handleStop ya registra la sesión y resuelve el estado de la tarea
      await handleStop(completeTask, actualTaskId);
      setShowFocus(false);
      return;
    }
    // El pomodoro registra todo el enfoque acumulado (aunque no se completara);
    // el resto de modos, el tiempo de la cuenta en curso.
    const elapsed = mode === 'pomodoro'
      ? pomodoroElapsed + (pomodoroPhase === 'work' ? Math.max(0, countdown.targetSeconds - countdown.remaining) : 0)
      : mode === 'intervalos'
        ? intervalElapsed + Math.max(0, countdown.targetSeconds - countdown.remaining)
        : countdown.targetSeconds - countdown.remaining;
    if (elapsed >= 1) {
      const timerMode: AppTimerMode = mode === 'pomodoro' ? 'pomodoro' : mode === 'intervalos' ? 'interval' : 'timer';
      await tracker.saveSession(elapsed, timerMode);
      if (settings.sounds) playCompleteSound();
    }
    // Duraciones recientes del temporizador (máximo 4, sin repetir).
    if (mode === 'temporizador') {
      const used = Math.round(countdown.targetSeconds / 60);
      if (used > 0) {
        updateTimerSettings('recentDurations', [used, ...timerSettings.recentDurations.filter((m) => m !== used)].slice(0, 4));
      }
    }
    // El pomodoro vuelve siempre a su enfoque configurado.
    if (mode === 'pomodoro') countdown.setTarget(timerSettings.pomodoroFocus);
    else countdown.reset();
    setIntervalRun(null);
    setIntervalElapsed(0);
    setPomodoroPhase('work');
    setPomodoroCycle(0);
    setPomodoroElapsed(0);
    handleTaskAfterSession(actualTaskId, completeTask, avanceTaskId);
    // Limpia taskId del draft para que la próxima sesión no se asocie a esta tarea
    tracker.setDraft((d) => ({ ...d, taskId: undefined, avanceTaskId: undefined }));
    setShowFocus(false);
  };

  // Silenciar la alarma guarda la sesión con el tiempo total: lo configurado
  // más la espera hasta apagarla.
  const handleSilenceAlarm = async () => {
    if (timerFinishedAt === null) return;
    const extra = Math.max(0, Math.floor((Date.now() - timerFinishedAt) / 1000));
    const total = countdown.targetSeconds + extra;
    const used = Math.round(countdown.targetSeconds / 60);
    const taskId = tracker.draft.taskId;
    const avanceTaskId = tracker.draft.avanceTaskId;
    setTimerFinishedAt(null);
    await tracker.saveSession(total, 'timer');
    if (used > 0) {
      updateTimerSettings('recentDurations', [used, ...timerSettings.recentDurations.filter((m) => m !== used)].slice(0, 4));
    }
    countdown.reset();
    handleTaskAfterSession(taskId, false, avanceTaskId);
    tracker.setDraft((d) => ({ ...d, taskId: undefined, avanceTaskId: undefined }));
    setShowFocus(false);
  };

  // Silenciar la alarma final del pomodoro guarda el enfoque acumulado.
  const handleSilencePomodoro = async () => {
    const focusSeconds = pomodoroElapsed;
    const taskId = tracker.draft.taskId;
    const avanceTaskId = tracker.draft.avanceTaskId;
    setPomodoroFinished(false);
    if (focusSeconds >= 1) await tracker.saveSession(focusSeconds, 'pomodoro');
    setPomodoroPhase('work');
    setPomodoroCycle(0);
    setPomodoroElapsed(0);
    countdown.setTarget(timerSettings.pomodoroFocus);
    handleTaskAfterSession(taskId, false, avanceTaskId);
    tracker.setDraft((d) => ({ ...d, taskId: undefined, avanceTaskId: undefined }));
    setShowFocus(false);
  };

  const historyEntries = useMemo(
    () => tracker.sessions.filter((e) => isoToDateKey(e.startTime) !== todayKey()),
    [tracker.sessions]
  );

  const handleSelectEntry = useCallback((e: { id: string }) => setSelectedEntryId(e.id), []);

  const isTimerActive = mode === 'rastreador'
    ? tracker.running !== null
    : mode === 'pomodoro'
      // Sigue activo entre sesiones cuando el inicio automático está apagado.
      ? (countdown.running || countdown.remaining < countdown.targetSeconds || pomodoroCycle > 0)
      : countdown.running || (countdown.remaining > 0 && countdown.remaining < countdown.targetSeconds);

  const activeElapsed = mode === 'rastreador'
    ? tracker.elapsed
    : countdown.targetSeconds - countdown.remaining;

  const activity = tracker.activities.find((a) => a.id === tracker.draft.activityId);

  const timerProps = {
    mode, onModeChange: handleModeChange,
    running: tracker.running, elapsed: tracker.elapsed,
    draft: tracker.draft, activities: tracker.activities,
    onStart: tracker.start, onPause: tracker.pause, onResume: tracker.resume, onStop: handleStop,
    onSetStartTime: tracker.setStartTime,
    onDescriptionChange: (v: string) => tracker.setDraft((d) => ({ ...d, description: v })),
    onActivityChange: (id: string) => tracker.setDraft((d) => ({ ...d, activityId: id })),
    onTaskIdChange: (id: string | undefined) => tracker.setDraft((d) => ({ ...d, taskId: id })),
    onCreateActivity: (name: string, color: string) => tracker.addActivity(name, color),
    countdown, pomodoroPhase, pomodoroCycle, onPomodoroSkip: handlePomodoroSkip,
    intervalRun: intervalRun
      ? {
          name: intervalRun.interval.name,
          stepIndex: intervalRun.stepIndex,
          stepsTotal: intervalRun.interval.steps.length,
          stepName: intervalRun.interval.steps[intervalRun.stepIndex]?.name ?? '',
          stepMinutes: intervalRun.interval.steps.map((st) => st.minutes),
        }
      : null,
    onStartInterval: handleStartInterval,
    onIntervalSkip: () => advanceInterval(true),
  };

  return (
    <>
      <section className="absolute top-0 left-0 w-full h-full flex flex-col">
        <SectionHeader title="Timer" onMenuClick={onMenuClick} onOpenAccount={onOpenAccount} background="#FFFFFF" className="z-50" />

        <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-[110px]">
          <div className="flex flex-col gap-5 mt-3">
            <TodaySummary
              entries={tracker.sessions}
              activities={tracker.activities}
              liveElapsed={tracker.running ? tracker.elapsed : 0}
              isRunning={tracker.isTicking}
              liveActivityId={tracker.draft.activityId}
              liveDescription={tracker.draft.description}
              onSelectEntry={handleSelectEntry}
            />

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-[#eceaf3]" />
              <span className="eyebrow">Historial</span>
              <div className="flex-1 h-px bg-[#eceaf3]" />
            </div>

            <EntryList
              entries={historyEntries}
              activities={tracker.activities}
              onDelete={tracker.deleteSession}
              onSelectEntry={handleSelectEntry}
            />
          </div>
        </div>

        <AnimatePresence>
          {!showFocus && isTimerActive && (
            <motion.div
              key="bar"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => setShowFocus(true)}
              className="absolute bottom-[85px] left-1/2 -translate-x-1/2 w-[90%] max-w-[350px] bg-white rounded-2xl shadow-[6px_6px_12px_#e6e6e6,-6px_-6px_12px_#ffffff] flex items-center gap-3 px-4 py-3 cursor-pointer z-30"
            >
              {mode === 'rastreador' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activity?.color ?? '#bbb' }} />
                  <span className="text-[14px] font-medium text-[#333] flex-1 truncate">{activity?.name ?? 'Sin actividad'}</span>
                  {tracker.isTicking && <span className="w-2 h-2 rounded-full bg-[#34c77b] animate-pulse shrink-0" />}
                  <span className="text-[15px] font-bold text-[#7f70ff] tabular-nums shrink-0">{formatElapsed(activeElapsed)}</span>
                </>
              )}
              {mode === 'temporizador' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7f70ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M9 2h6" /><path d="M12 5V2" /></svg>
                  <span className="text-[14px] font-medium text-[#333] flex-1">Temporizador</span>
                  <span className="text-[15px] font-bold text-[#7f70ff] tabular-nums shrink-0">{formatElapsed(activeElapsed)}</span>
                </>
              )}
              {mode === 'pomodoro' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pomodoroPhase === 'work' ? '#7f70ff' : '#34c77b' }} />
                  <span className="text-[14px] font-medium text-[#333] flex-1">
                    {pomodoroPhase === 'work' ? 'Trabajo' : pomodoroPhase === 'longBreak' ? 'Descanso largo' : 'Descanso'} · Ciclo {pomodoroCycle}
                  </span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: pomodoroPhase === 'work' ? '#7f70ff' : '#34c77b' }}>{formatElapsed(activeElapsed)}</span>
                </>
              )}
              {mode === 'intervalos' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#7f70ff' }} />
                  <span className="text-[14px] font-medium text-[#333] flex-1 truncate">
                    {intervalRun ? `${intervalRun.interval.steps[intervalRun.stepIndex]?.name ?? 'Intervalo'} · ${intervalRun.stepIndex + 1}/${intervalRun.interval.steps.length}` : 'Intervalos'}
                  </span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: '#7f70ff' }}>{formatElapsed(activeElapsed)}</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {showFocus && (
          <FocusScreen
            key="focus"
            onBack={() => setShowFocus(false)}
            {...timerProps}
            taskLists={taskLists}
            tasks={tasks}
            onNotesChange={(v) => tracker.setDraft((d) => ({ ...d, notes: v }))}
            onSyncTaskNotes={(taskId, notes) => tasksColl.update(taskId, { notes })}
            onDiscard={handleDiscard}
            onSaveSession={handleSaveSession}
            onSaveManualSession={async (startMs, endMs) => {
              const taskId = tracker.draft.taskId;
              await tracker.saveManualSession(startMs, endMs);
              handleTaskAfterSession(taskId, false);
              tracker.setDraft((d) => ({ ...d, taskId: undefined, avanceTaskId: undefined }));
              setShowFocus(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Temporizador completado: alarma sonando hasta silenciarla */}
      <AnimatePresence>
        {timerFinishedAt !== null && (
          <TimerCompleteScreen
            key="timer-complete"
            targetSeconds={countdown.targetSeconds}
            finishedAt={timerFinishedAt}
            soundEnabled={settings.sounds}
            sound={timerSettings.timerAlarmSound}
            vibrate={timerSettings.timerAlarmVibrate}
            onSilence={handleSilenceAlarm}
          />
        )}
      </AnimatePresence>

      {/* Pomodoro completado: alarma final hasta que la silencie */}
      <AnimatePresence>
        {pomodoroFinished && (
          <PomodoroCompleteScreen
            key="pomodoro-complete"
            focusSeconds={pomodoroElapsed}
            sessionsDone={pomodoroCycle}
            sessionsTotal={timerSettings.pomodoroLongBreakEvery}
            soundEnabled={settings.sounds}
            sound={timerSettings.pomodoroAlarmSound}
            vibrate={timerSettings.timerAlarmVibrate}
            onSilence={handleSilencePomodoro}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEntry && (
          <SessionDetailModal
            key={selectedEntry.id}
            entry={selectedEntry}
            onUpdate={tracker.updateSession}
            onDelete={tracker.deleteSession}
            onClose={() => setSelectedEntryId(null)}
            tasks={tasks}
            taskLists={taskLists}
            onLinkTask={(entry, task) => { if (uid) incrementTaskTime(uid, task.id, entry.duration); }}
            onUnlinkTask={(entry) => { if (uid && entry.taskId) incrementTaskTime(uid, entry.taskId, -entry.duration); }}
            onSyncToTask={(taskId, updates) => tasksColl.update(taskId, updates)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
