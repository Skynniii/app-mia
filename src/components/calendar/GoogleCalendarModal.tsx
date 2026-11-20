import { useState } from 'react';
import { motion } from 'framer-motion';
import { useBackHandler } from '../../hooks/useBackHandler';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { BackButton, DETAIL_HEADER_TOP } from '../ui/DetailScreen';
import type { GoogleCalendarLink } from '../../types';

interface Props {
  onClose: () => void;
}

const KIND_LABEL: Record<GoogleCalendarLink['kind'], string> = {
  calendar: 'Eventos',
  birthday: 'Cumpleaños',
  holiday: 'Festivos',
};

/** Pasos para encontrar la dirección iCal de un calendario de Google. */
function Steps() {
  const items = [
    'Abre calendar.google.com en el navegador (mejor en el computador).',
    'Entra en Ajustes y elige el calendario: principal, Cumpleaños o Festivos.',
    'Baja hasta «Dirección secreta en formato iCal» y cópiala.',
    'Pégala aquí y toca Vincular. Repite con cada calendario que quieras traer.',
  ];
  return (
    <ol className="m-0 pl-4 space-y-1 text-[12.5px] leading-relaxed text-[#7a7a86]">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ol>
  );
}

export function GoogleCalendarModal({ onClose }: Props) {
  useBackHandler(true, onClose);
  const { links, syncing, error, addLink, removeLink, syncNow, lastSyncLabel } = useGoogleCalendar();
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!url.trim() || adding) return;
    setAdding(true);
    setFormError(null);
    try {
      await addLink(url);
      setUrl('');
    } catch (e) {
      setFormError((e as Error)?.message ?? 'No se pudo vincular el calendario.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 bg-white z-[2100] flex flex-col overflow-y-auto no-scrollbar"
    >
      <div className="sticky top-0 z-10 bg-white pb-2" style={{ paddingTop: DETAIL_HEADER_TOP }}>
        <div className="flex items-center gap-3 px-4">
          <BackButton onClick={onClose} />
          <div className="min-w-0">
            <h1 className="text-[#2b2b2b] font-bold text-2xl m-0">Google Calendar</h1>
            <p className="text-[13px] text-[#999] m-0 mt-0.5">Eventos, cumpleaños y festivos</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-[100px]">
        <div className="p-4 rounded-2xl bg-[#f8f8fa] border border-[#eee]">
          <p className="text-[13px] font-semibold text-[#333] m-0 mb-2">Cómo vincularlo</p>
          <Steps />
        </div>

        <div className="mt-4">
          <label className="text-[12px] font-bold text-[#555] uppercase tracking-wider">Dirección iCal</label>
          <textarea
            value={url}
            onChange={(e) => { setUrl(e.target.value); setFormError(null); }}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            rows={2}
            className="w-full mt-2 p-3 rounded-xl border border-[#e4e4ed] bg-white text-[13px] text-[#333] outline-none focus:border-[#7f70ff] resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="w-full mt-2 py-3 rounded-xl border-none text-sm font-semibold text-white cursor-pointer disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--accent, #7f70ff)' }}
          >
            {adding ? 'Vinculando…' : 'Vincular calendario'}
          </button>
          {formError && <p className="text-[12.5px] text-[#e5484d] mt-2 m-0">{formError}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-[12px] font-bold text-[#555] uppercase tracking-wider m-0">
            Vinculados {links.length > 0 && `(${links.length})`}
          </p>
          {links.length > 0 && (
            <button
              onClick={() => void syncNow()}
              disabled={syncing}
              className="text-[12px] font-semibold border-none bg-transparent cursor-pointer disabled:opacity-50"
              style={{ color: 'var(--accent, #7f70ff)' }}
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          )}
        </div>

        {error && <p className="text-[12.5px] text-[#e5484d] mt-2 m-0">{error}</p>}

        {links.length === 0 ? (
          <p className="text-[13px] text-[#999] mt-3">Aún no hay calendarios vinculados.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-2xl border border-[#eee] bg-white">
                <span className="w-2.5 h-9 rounded-full shrink-0" style={{ background: link.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#333] m-0 truncate">{link.name}</p>
                  <p className="text-[11.5px] text-[#999] m-0 mt-0.5">
                    {KIND_LABEL[link.kind]} · {lastSyncLabel(link)}
                  </p>
                </div>
                <button
                  onClick={() => void removeLink(link.id)}
                  title="Quitar calendario"
                  className="w-8 h-8 flex items-center justify-center rounded-full border-none bg-[#fff5f5] text-[#ff4d4d] cursor-pointer active:scale-90 transition-transform shrink-0"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11.5px] text-[#a5a5b0] mt-5 leading-relaxed">
          Se actualiza automáticamente cada 6 horas y al abrir el calendario. Los cambios hechos
          en Google llegan a la app; los eventos importados no se editan aquí.
        </p>
      </div>
    </motion.div>
  );
}
