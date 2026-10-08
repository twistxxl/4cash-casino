import { cn } from '@/shared/lib/cn';

/** Знак 4cash: четыре фишки, сложенные в ромб */
export function Logo({
  className,
  withText = true,
  textClassName,
}: {
  className?: string;
  withText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#logo-g)" />
        <circle cx="16" cy="10" r="3.2" fill="white" fillOpacity="0.95" />
        <circle cx="10" cy="16" r="3.2" fill="white" fillOpacity="0.8" />
        <circle cx="22" cy="16" r="3.2" fill="white" fillOpacity="0.8" />
        <circle cx="16" cy="22" r="3.2" fill="white" fillOpacity="0.65" />
      </svg>
      {withText && (
        <span className={cn('font-display text-lg font-bold tracking-tight', textClassName)}>
          4<span className="text-primary">cash</span>
        </span>
      )}
    </span>
  );
}
