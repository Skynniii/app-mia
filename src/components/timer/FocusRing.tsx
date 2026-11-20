import { useId, type ReactNode } from 'react';

interface Props {
  progress: number; // 0–1: porción del anillo que sigue llena
  color: string;
  size?: number;
  stroke?: number;
  trackColor?: string;
  isStatic?: boolean;
  /** Muestra un brillo que recorre la parte llena del anillo girando. */
  shimmer?: boolean;
  children: ReactNode;
}

export function FocusRing({ progress, color, size = 220, stroke = 8, trackColor = '#eceaf3', isStatic = false, shimmer = false, children }: Props) {
  const uid = useId().replace(/[:]/g, '');
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  // Desplazamiento negativo: el anillo se vacía en el mismo sentido (horario)
  // en el que gira el brillo, dejando el hueco desde la parte superior.
  const offset = -circumference * (1 - clamped);
  const shimmerLen = circumference * 0.16;
  const arcStyle = { transition: 'stroke-dashoffset 0.9s linear' };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-shimmer-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* El brillo solo se ve sobre la parte del anillo que sigue llena. */}
          <mask id={`ring-arc-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="#ffffff" strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={arcStyle}
            />
          </mask>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {!isStatic && (
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ ...arcStyle, filter: `drop-shadow(0 0 4px ${color}33)` }}
          />
        )}
        {shimmer && !isStatic && (
          <g mask={`url(#ring-arc-${uid})`}>
            <g className="anim-ring-shimmer">
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke={`url(#ring-shimmer-${uid})`} strokeWidth={stroke}
                strokeDasharray={`${shimmerLen} ${circumference - shimmerLen}`}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.95))' }}
              />
            </g>
          </g>
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
