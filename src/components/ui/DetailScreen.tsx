/**
 * Cabecera común de las pantallas de detalle (tarea, focus, sesión, actividad,
 * búsqueda del calendario, ajustes, cuenta...). Todas comparten el mismo aire
 * superior para que el contenido no choque con la barra de estado y las
 * pantallas queden simétricas.
 */
export const DETAIL_HEADER_TOP = 'max(env(safe-area-inset-top), 20px)';

interface BackButtonProps {
  onClick: () => void;
  /** Etiqueta accesible del botón. */
  label?: string;
  color?: string;
}

/** Botón de atrás de las esquinas superiores: mismo tamaño en toda la app. */
export function BackButton({ onClick, label = 'Volver', color = '#555' }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 flex-none flex items-center justify-center rounded-full hover:bg-black/5 transition-colors active:scale-90 border-none bg-transparent cursor-pointer"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
