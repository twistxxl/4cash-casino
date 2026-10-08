'use client';

import { Check, Copy, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AUTHOR } from '@/shared/config';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';

/** Ссылка на Telegram автора + копирование ника */
export function TelegramContact({ className, size = 'default' }: { className?: string; size?: 'default' | 'lg' }) {
  const t = useTranslations('author');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`@${AUTHOR.telegram}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // буфер обмена недоступен — ник и так виден на кнопке
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button asChild size={size}>
        <a href={AUTHOR.telegramUrl} target="_blank" rel="noreferrer">
          <Send />
          {t('write')} @{AUTHOR.telegram}
        </a>
      </Button>
      <Button variant="glass" size={size === 'lg' ? 'lg' : 'default'} onClick={copy} aria-label={t('copy')}>
        {copied ? <Check className="text-win" /> : <Copy />}
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}
