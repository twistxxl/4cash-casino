'use client';

import { memo } from 'react';
import { pocketColor, WHEEL_ORDER } from '@/shared/lib/roulette';

const SIZE = 320;
const C = SIZE / 2;
const R_OUTER = 150;
const R_INNER = 104;
const R_TEXT = 132;
const SEG = 360 / WHEEL_ORDER.length;

const FILL = { red: 'var(--wheel-red)', black: 'var(--wheel-black)', green: 'var(--wheel-green)' } as const;

/** Точка на окружности; угол — по часовой стрелке от 12 часов */
function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) };
}

function sectorPath(i: number) {
  const a0 = i * SEG - SEG / 2;
  const a1 = i * SEG + SEG / 2;
  const p0 = polar(R_OUTER, a0);
  const p1 = polar(R_OUTER, a1);
  const p2 = polar(R_INNER, a1);
  const p3 = polar(R_INNER, a0);
  return `M${p0.x} ${p0.y} A${R_OUTER} ${R_OUTER} 0 0 1 ${p1.x} ${p1.y} L${p2.x} ${p2.y} A${R_INNER} ${R_INNER} 0 0 0 ${p3.x} ${p3.y}Z`;
}

const WheelFace = memo(function WheelFace() {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full">
      <defs>
        <radialGradient id="wheel-hub" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="var(--glass-strong)" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R_OUTER + 8} fill="var(--wheel-black)" opacity="0.9" />
      {WHEEL_ORDER.map((n, i) => {
        const text = polar(R_TEXT, i * SEG);
        return (
          <g key={n}>
            <path d={sectorPath(i)} fill={FILL[pocketColor(n)]} stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
            <text
              x={text.x}
              y={text.y}
              fill="white"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-rubik)"
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${i * SEG} ${text.x} ${text.y})`}
            >
              {n}
            </text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_INNER} fill="url(#wheel-hub)" />
      <circle cx={C} cy={C} r={R_INNER - 14} fill="none" stroke="rgba(255,255,255,0.25)" strokeDasharray="3 6" />
      {[0, 45, 90, 135].map((a) => {
        const p = polar(R_INNER - 22, a);
        const q = polar(R_INNER - 22, a + 180);
        return <line key={a} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" />;
      })}
      <circle cx={C} cy={C} r="16" fill="var(--primary)" />
      <circle cx={C} cy={C} r="6" fill="white" opacity="0.9" />
    </svg>
  );
});

/**
 * Колесо крутится CSS-переходом к углу, при котором выпавшее число окажется под указателем.
 * Само число определяет сервер (roulette-service), фронт только анимирует результат.
 */
export function Wheel({
  rotation,
  spinning,
  onSpinEnd,
}: {
  rotation: number;
  spinning: boolean;
  onSpinEnd: () => void;
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" aria-hidden />
      <div
        className="relative size-full motion-reduce:!duration-500"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.75, 0.15, 1)' : 'none',
        }}
        onTransitionEnd={onSpinEnd}
      >
        <WheelFace />
      </div>
      {/* указатель */}
      <svg viewBox="0 0 24 24" className="absolute -top-1 left-1/2 size-7 -translate-x-1/2 drop-shadow-md" aria-hidden>
        <path d="M12 22 L3 4 Q12 0 21 4 Z" fill="var(--accent)" stroke="white" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** Угол, на который нужно докрутить колесо, чтобы число оказалось под указателем (с запасом в несколько оборотов) */
export function rotationFor(number: number, current: number, turns = 6): number {
  const target = (360 - WHEEL_ORDER.indexOf(number as (typeof WHEEL_ORDER)[number]) * SEG) % 360;
  const base = current - (((current % 360) + 360) % 360);
  return base + turns * 360 + target;
}
