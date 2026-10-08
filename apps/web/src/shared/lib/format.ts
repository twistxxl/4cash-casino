'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

/** Форматирование чисел и времени под текущую локаль */
export function useFormat() {
  const locale = useLocale();
  return useMemo(() => {
    const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateTime = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return {
      chips: (n: number) => int.format(n),
      signed: (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + int.format(Math.abs(n)),
      time: (iso: string) => time.format(new Date(iso)),
      dateTime: (iso: string) => dateTime.format(new Date(iso)),
      ago: (iso: string) => {
        const sec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
        if (Math.abs(sec) < 60) return relative.format(sec, 'second');
        if (Math.abs(sec) < 3600) return relative.format(Math.round(sec / 60), 'minute');
        return relative.format(Math.round(sec / 3600), 'hour');
      },
    };
  }, [locale]);
}
