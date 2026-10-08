'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError } from '@/shared/api';

const KNOWN = [
  'INSUFFICIENT_FUNDS',
  'PLAYER_BLOCKED',
  'PLAYER_NOT_FOUND',
  'USERNAME_TAKEN',
  'INVALID_AMOUNT',
  'TOO_LATE',
  'NO_ACTIVE_BET',
  'ROUND_NOT_STARTED',
  'NO_RUNNING_ROUND',
  'NETWORK',
] as const;
type KnownCode = (typeof KNOWN)[number];

/** Переводит коды ошибок gateway ("INSUFFICIENT_FUNDS: баланс 30") в понятный текст */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown): string => {
      const code = error instanceof ApiError ? error.code : error instanceof Error ? error.message : String(error);
      if ((KNOWN as readonly string[]).includes(code)) return t(code as KnownCode);
      if (error instanceof ApiError && error.status === 504) return t('TIMEOUT');
      return error instanceof Error ? error.message : t('UNKNOWN');
    },
    [t],
  );
}
