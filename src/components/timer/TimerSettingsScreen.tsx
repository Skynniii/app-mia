import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { useSettings } from '../../context/SettingsContext';
import { useTimerSettings, FOCUS_THEMES, type CustomInterval } from '../../hooks/useTimerSettings';
import { ALARM_SOUNDS, playAlarmPreview } from '../../utils/alarm';
import { CustomDurationModal } from './CustomDurationModal';
import { IntervalFormModal } from './IntervalFormModal';
import { BackButton, DETAIL_HEADER_TOP } from '../ui/DetailScreen';

interface Props {
  onBack: () => void;
}

type DurationKey = 'pomodoroFocus' | 'pomodoroBreak' | 'pomodoroLongBreak';

const DURATION_ROWS: { key: DurationKey; label: string; hint: string }[] = [
  { key: 'pomodoroFocus', label: 'Duración del enfoque', hint: 'Tiempo de trabajo por sesión' },
  { key: 'pomodoroBreak', label: 'Descanso', hint: 'Pausa entre sesiones de enfoque' },
  { key: 'pomodoroLongBreak', label: 'Descanso largo', hint: 'Pausa al cerrar el ciclo' },
];

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="w-[48px] h-[28px] rounded-full transition-colors duration-200 flex items-center shrink-0"
      style={{ background: on ? 'var(--accent, #7f70ff)' : '#e0e0e0' }}
    >
      <span className={`block w-[24px] h-[24px] bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-4">
      <h3 className="eyebrow whitespace-nowrap m-0">{children}</h3>
      <div className="flex-1 h-px bg-[#e8e8e8] ml-1" />
    </div>
  );
}

function Row({ label, hint, children, onClick }: { label: string; hint?: string; children: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#333]">{label}</span>
        {hint && <span className="block text-[13px] text-[#999] mt-0.5">{hint}</span>}
      </span>
      <span className="flex items-center gap-2 shrink-0 text-[14px] font-semibold text-[#7f70ff]">
        {children}
        {onClick && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        )}
      </span>
    </>
  );
  const className = 'w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[#f8f8fa] rounded-2xl border border-[#eee]';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} cursor-pointer text-left`}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

/** Configuración exclusiva de la sección Timer, ordenada por modo. */
export function TimerSettingsScreen({ onBack }: Props) {
  useBackHandler(true, onBack);
  const { timerSettings, updateTimerSettings } = useTimerSettings();
  const { settings, update } = useSettings();
  const [durationKey, setDurationKey] = useState<DurationKey | null>(null);
  const [intervalForm, setIntervalForm] = useState<{ open: boolean; interval: CustomInterval | null }>({ open: false, interval: null });
  const [alarmOpen, setAlarmOpen] = useState(false);
  // El botón atrás cierra primero la hoja del sonido de alarma.
  useBackHandler(alarmOpen, () => setAlarmOpen(false));

  const saveInterval = (iv: CustomInterval) => {
    updateTimerSettings('intervals', [
      ...timerSettings.intervals.filter((i) => i.id !== iv.id),
      iv,
    ]);
  };

  const deleteInterval = (id: string) => {
    updateTimerSettings('intervals', timerSettings.intervals.filter((i) => i.id !== id));
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute top-0 left-0 w-full h-full bg-white z-[1100] flex flex-col overflow-y-auto no-scrollbar"
    >
      <div className="sticky top-0 z-10 bg-white pb-2" style={{ paddingTop: DETAIL_HEADER_TOP }}>
        <div className="flex items-center gap-3 px-4">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-[#1c1c23] font-bold text-[22px] leading-tight tracking-[-0.03em] m-0">Timer</h1>
            <p className="text-[13px] text-[#999] m-0 mt-0.5">Configuración de la sección</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-[100px]">
        {/* RASTREADOR */}
        <SectionTitle>Rastreador</SectionTitle>
        <p className="text-[13px] text-[#999] m-0">El cronómetro no tiene ajustes propios. El registro manual está en el botón de calendario.</p>

        {/* TEMPORIZADOR */}
        <SectionTitle>Temporizador</SectionTitle>
        <div className="space-y-3">
          <Row label="Sonido de alarma" hint="Suena al terminar el temporizador" onClick={() => setAlarmOpen(true)}>
            {ALARM_SOUNDS.find((s) => s.id === timerSettings.timerAlarmSound)?.name ?? 'Campana'}
          </Row>
          <Row label="Vibración" hint="Vibra junto con la alarma">
            <Toggle on={timerSettings.timerAlarmVibrate} onChange={(v) => updateTimerSettings('timerAlarmVibrate', v)} />
          </Row>
        </div>

        {/* POMODORO */}
        <SectionTitle>Pomodoro</SectionTitle>
        <div className="space-y-3">
          {DURATION_ROWS.map((row) => (
            <Row key={row.key} label={row.label} hint={row.hint} onClick={() => setDurationKey(row.key)}>
              {formatMinutes(timerSettings[row.key])}
            </Row>
          ))}
          <Row label="Descanso largo cada" hint="Sesiones de enfoque por ciclo">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateTimerSettings('pomodoroLongBreakEvery', Math.max(2, timerSettings.pomodoroLongBreakEvery - 1))}
                className="w-8 h-8 rounded-full bg-white border border-[#e8e8ed] cursor-pointer flex items-center justify-center text-[#7f70ff] active:scale-90 transition-transform"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
              <span className="w-[52px] text-center tabular-nums text-[#333]">{timerSettings.pomodoroLongBreakEvery} ses.</span>
              <button
                type="button"
                onClick={() => updateTimerSettings('pomodoroLongBreakEvery', Math.min(12, timerSettings.pomodoroLongBreakEvery + 1))}
                className="w-8 h-8 rounded-full bg-white border border-[#e8e8ed] cursor-pointer flex items-center justify-center text-[#7f70ff] active:scale-90 transition-transform"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
            </div>
          </Row>
        </div>

        {/* INTERVALOS */}
        <SectionTitle>Intervalos</SectionTitle>
        <div className="space-y-3">
          {timerSettings.intervals.length === 0 && (
            <p className="text-[13px] text-[#999] m-0">Crea intervalos propios de enfoque y descanso.</p>
          )}
          {timerSettings.intervals.map((iv) => (
            <button
              key={iv.id}
              type="button"
              onClick={() => setIntervalForm({ open: true, interval: iv })}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[#f8f8fa] rounded-2xl border border-[#eee] cursor-pointer text-left"
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[#333] truncate">{iv.name}</span>
                <span className="block text-[13px] text-[#999] mt-0.5">
                  {formatMinutes(iv.focusMin)} · {formatMinutes(iv.restMin)} descanso · {iv.rounds} rondas
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIntervalForm({ open: true, interval: null })}
            className="w-full py-3 rounded-2xl border border-dashed border-[#7f70ff] bg-transparent text-[14px] font-semibold text-[#7f70ff] cursor-pointer"
          >
            + Nuevo intervalo
          </button>
        </div>

        {/* CONCENTRACIÓN */}
        <SectionTitle>Concentración</SectionTitle>
        <div className="rounded-2xl border border-[#eee] bg-[#f8f8fa] p-4 mb-3">
          <p className="text-[15px] font-semibold text-[#333] m-0">Tema</p>
          <p className="text-[13px] text-[#999] m-0 mt-0.5">Aspecto de la pantalla enfocada</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {FOCUS_THEMES.map((t) => {
              const active = timerSettings.focusTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => updateTimerSettings('focusTheme', t.id)}
                  className={`py-2.5 rounded-xl border cursor-pointer transition-colors ${active ? 'border-[#7f70ff] bg-white text-[#7f70ff]' : 'border-transparent bg-white/60 text-[#888]'}`}
                >
                  <span className="block text-[13px] font-semibold">{t.name}</span>
                  <span className="block text-[11px] mt-0.5 opacity-70">{t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <Row label="Iniciar en concentración" hint="Abre el modo al empezar cualquier timer">
            <Toggle on={timerSettings.startInFocusMode} onChange={(v) => updateTimerSettings('startInFocusMode', v)} />
          </Row>
          <Row label="Mantener pantalla encendida" hint="Durante el modo concentración">
            <Toggle on={timerSettings.keepScreenOn} onChange={(v) => updateTimerSettings('keepScreenOn', v)} />
          </Row>
        </div>

        {/* AVISOS */}
        <SectionTitle>Avisos</SectionTitle>
        <div className="space-y-3">
          {([{ key: 'sounds' as const, label: 'Sonidos', hint: 'Aviso al terminar cada fase' }, { key: 'notifications' as const, label: 'Notificaciones', hint: 'Avisos del sistema' }]).map((item) => (
            <Row key={item.key} label={item.label} hint={item.hint}>
              <Toggle on={settings[item.key]} onChange={(v) => update(item.key, v)} />
            </Row>
          ))}
        </div>
      </div>

      <CustomDurationModal
        isOpen={durationKey !== null}
        title={DURATION_ROWS.find((r) => r.key === durationKey)?.label ?? 'Duración'}
        initialMinutes={durationKey ? timerSettings[durationKey] : 25}
        onClose={() => setDurationKey(null)}
        onSave={(h, m) => {
          if (durationKey) updateTimerSettings(durationKey, Math.max(1, h * 60 + m));
        }}
      />

      <IntervalFormModal
        isOpen={intervalForm.open}
        interval={intervalForm.interval}
        onClose={() => setIntervalForm({ open: false, interval: null })}
        onSave={saveInterval}
        onDelete={deleteInterval}
      />

      {/* Selector de sonido de alarma (cada opción se escucha al tocarla) */}
      <AnimatePresence>
        {alarmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-black/30 flex items-end"
            onClick={() => setAlarmOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full bg-white rounded-t-3xl px-4 pt-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[17px] font-bold text-[#1c1c23] m-0 mb-3 tracking-[-0.02em]">Sonido de alarma</h3>
              <div className="space-y-2">
                {ALARM_SOUNDS.map((s) => {
                  const active = timerSettings.timerAlarmSound === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { updateTimerSettings('timerAlarmSound', s.id); playAlarmPreview(s.id); }}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border cursor-pointer text-left ${active ? 'border-[#7f70ff] bg-[#f5f3ff]' : 'border-[#eee] bg-[#f8f8fa]'}`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-[15px] font-semibold ${active ? 'text-[#7f70ff]' : 'text-[#333]'}`}>{s.name}</span>
                        <span className="block text-[13px] text-[#999] mt-0.5">{s.hint}</span>
                      </span>
                      {active ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7f70ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#bbb"><path d="M8 5v14l11-7z" /></svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setAlarmOpen(false)}
                className="mt-4 w-full py-3 rounded-2xl bg-[#f7f6f9] border-none text-[14px] font-semibold text-[#555] cursor-pointer"
              >
                Listo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
