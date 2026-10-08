'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { playerKeys } from '@/entities/player';
import { api, type PlayerDetails } from '@/shared/api';
import { useErrorMessage } from '@/shared/lib';
import { AmountInput, Button, Label } from '@/shared/ui';

type Kind = 'deposit' | 'withdraw';

const PRESETS: Record<Kind, number[]> = {
  deposit: [500, 1000, 5000, 10000],
  withdraw: [100, 500, 1000, 5000],
};

/**
 * Депозит и вывод — синхронный RPC в wallet через RabbitMQ.
 * Ответ сразу содержит новый баланс; уведомление «зачислено» придёт отдельно,
 * через exchange notifications → SSE.
 */
export function MoneyForm({ kind, playerId, disabled }: { kind: Kind; playerId: string; disabled?: boolean }) {
  const t = useTranslations('wallet');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(PRESETS[kind][1]));

  const mutation = useMutation({
    mutationFn: () =>
      api<{ balance: number }>(`/players/${playerId}/${kind}`, { method: 'POST', json: { amount: Number(amount) } }),
    onSuccess: ({ balance }) => {
      qc.setQueryData<PlayerDetails>(playerKeys.detail(playerId), (old) => (old ? { ...old, balance } : old));
      qc.invalidateQueries({ queryKey: playerKeys.detail(playerId) });
      if (kind === 'withdraw') toast.info(t('withdrawQueued'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (Number(amount) > 0) mutation.mutate();
  };

  const Icon = kind === 'deposit' ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Label htmlFor={`${kind}-amount`}>{t(`${kind}.label`)}</Label>
      <AmountInput
        id={`${kind}-amount`}
        value={amount}
        onChange={setAmount}
        presets={PRESETS[kind]}
        disabled={disabled || mutation.isPending}
      />
      <p className="text-xs text-muted-foreground">{t(`${kind}.hint`)}</p>
      <Button
        type="submit"
        variant={kind === 'deposit' ? 'default' : 'glass'}
        size="lg"
        disabled={disabled || mutation.isPending || !Number(amount)}
      >
        {mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Icon />}
        {t(`${kind}.submit`)}
      </Button>
    </form>
  );
}
