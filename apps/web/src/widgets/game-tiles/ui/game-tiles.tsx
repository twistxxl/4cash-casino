'use client';

import { ArrowRight, CircleDot, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { CrashHistory, useCrashStore, useLiveMultiplier } from '@/entities/crash';
import { Link } from '@/shared/i18n';
import { formatMultiplier } from '@/shared/lib/crash';
import { RED_NUMBERS } from '@/shared/lib/roulette';
import { cn } from '@/shared/lib/cn';

function CrashLive() {
  const t = useTranslations('crash');
  const ref = useRef<HTMLSpanElement>(null);
  const phase = useCrashStore((s) => s.phase);
  const history = useCrashStore((s) => s.history);
  useLiveMultiplier(ref, formatMultiplier);
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline gap-3">
        <span ref={ref} className={cn('font-display text-4xl font-bold tabular-nums', phase === 'crashed' ? 'text-loss' : 'text-foreground')}>
          1.00×
        </span>
        <span className="text-sm font-semibold text-muted-foreground">{t(`phase.${phase}`)}</span>
      </div>
      <CrashHistory points={history.slice(0, 8)} />
    </div>
  );
}

function RouletteStrip() {
  // декоративная полоса чисел колеса
  return (
    <div className="flex gap-1 overflow-hidden" aria-hidden>
      {[32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 0].map((n) => (
        <span
          key={n}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold text-white',
            n === 0 ? 'bg-[var(--wheel-green)]' : RED_NUMBERS.has(n) ? 'bg-[var(--wheel-red)]' : 'bg-[var(--wheel-black)]',
          )}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

export function GameTiles() {
  const t = useTranslations('lobby.games');
  const tiles = [
    { href: '/roulette', key: 'roulette', icon: CircleDot, body: <RouletteStrip /> },
    { href: '/crash', key: 'crash', icon: TrendingUp, body: <CrashLive /> },
  ] as const;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {tiles.map(({ href, key, icon: Icon, body }) => (
        <Link
          key={key}
          href={href}
          className="glass group relative grid gap-5 overflow-hidden rounded-3xl p-6 transition hover:-translate-y-1 hover:[background:var(--glass-strong)] focus-visible:ring-2 focus-visible:ring-ring sm:p-7"
        >
          <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-primary/20 blur-3xl transition group-hover:bg-primary/30" aria-hidden />
          <div className="relative flex items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold">{t(`${key}.title`)}</h2>
              <p className="max-w-sm text-sm text-muted-foreground">{t(`${key}.text`)}</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <div className="relative">{body}</div>
        </Link>
      ))}
    </div>
  );
}
