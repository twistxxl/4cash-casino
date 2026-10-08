'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { useStreamStatus } from '@/shared/model/stream-status';

/** Индикатор SSE-соединения: зелёный — события из Kafka и RabbitMQ идут вживую */
export function StreamIndicator() {
  const t = useTranslations('header.stream');
  const status = useStreamStatus((s) => s.status);
  const live = status === 'open';
  return (
    <span
      title={status === 'open' ? undefined : t(status)}
      className="glass hidden h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground md:inline-flex"
    >
      <span className="relative flex size-2">
        {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-win opacity-60" />}
        <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-win' : 'bg-warn')} />
      </span>
      {live ? t('live') : t('short')}
    </span>
  );
}
