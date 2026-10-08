'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { routing, usePathname, useRouter } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

/** RU / EN: меняет префикс локали в URL, оставаясь на той же странице */
export function LocaleSwitcher() {
  const t = useTranslations('header');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t('language')} className="glass flex h-9 items-center rounded-xl p-0.5">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() => startTransition(() => router.replace(pathname, { locale: l }))}
          className={cn(
            'h-full rounded-[10px] px-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground transition',
            l === locale ? 'bg-surface text-foreground shadow-sm' : 'hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
