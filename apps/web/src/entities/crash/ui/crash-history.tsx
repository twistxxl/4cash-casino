'use client';

import { formatMultiplier } from '@/shared/lib/crash';
import { cn } from '@/shared/lib/cn';

/** Цвет точки краша: красный — сгорело рано, синий — средне, зелёный — высоко */
export function crashTone(m: number) {
  if (m < 1.5) return 'bg-loss/14 text-loss';
  if (m < 3) return 'bg-primary/12 text-primary';
  return 'bg-win/14 text-win';
}

export function CrashHistory({ points, className }: { points: number[]; className?: string }) {
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]', className)}>
      {points.map((p, i) => (
        <span
          key={`${i}-${p}`}
          className={cn('shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-bold tabular-nums', crashTone(p))}
        >
          {formatMultiplier(p)}
        </span>
      ))}
    </div>
  );
}
