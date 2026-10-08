'use client';

import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

/** Сумма в фишках с маленьким значком фишки */
export function Chips({ value, signed = false, className }: { value: number; signed?: boolean; className?: string }) {
  const f = useFormat();
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', className)}>
      <svg viewBox="0 0 16 16" className="size-[0.85em] shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.18" />
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="2.2 2.2" />
        <circle cx="8" cy="8" r="3.4" fill="currentColor" fillOpacity="0.55" />
      </svg>
      {signed ? f.signed(value) : f.chips(value)}
    </span>
  );
}
