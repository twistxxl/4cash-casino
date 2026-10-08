'use client';

import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { Input } from './input';

/** Поле суммы в фишках + быстрые кнопки */
export function AmountInput({
  id,
  value,
  onChange,
  presets,
  disabled,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  presets: number[];
  disabled?: boolean;
  className?: string;
}) {
  const f = useFormat();
  return (
    <div className={cn('grid gap-2', className)}>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
        className="h-12 text-lg font-semibold"
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(String(p))}
            className={cn(
              'rounded-lg border border-border px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50',
              value === String(p) && 'border-primary/60 bg-primary/10 text-primary',
            )}
          >
            {f.chips(p)}
          </button>
        ))}
      </div>
    </div>
  );
}
