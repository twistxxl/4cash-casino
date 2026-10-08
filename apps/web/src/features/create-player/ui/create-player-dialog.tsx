'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { playerKeys, usePlayerStore } from '@/entities/player';
import { api, type PlayerDetails } from '@/shared/api';
import { useErrorMessage } from '@/shared/lib';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@/shared/ui';

export function CreatePlayerDialog() {
  const t = useTranslations('player.create');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const select = usePlayerStore((s) => s.select);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [deposit, setDeposit] = useState('5000');

  const create = useMutation({
    mutationFn: () =>
      api<PlayerDetails>('/players', {
        method: 'POST',
        json: { username: username.trim(), deposit: Number(deposit) || undefined },
      }),
    onSuccess: (player) => {
      qc.setQueryData(playerKeys.detail(player.id), player);
      qc.invalidateQueries({ queryKey: playerKeys.all });
      select(player.id);
      toast.success(t('success', { username: player.username }));
      setOpen(false);
      setUsername('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="glass">
          <UserPlus />
          {t('open')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-username">{t('username')}</Label>
            <Input
              id="new-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('usernamePlaceholder')}
              minLength={3}
              maxLength={24}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-deposit">{t('deposit')}</Label>
            <Input
              id="new-deposit"
              inputMode="numeric"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button type="submit" size="lg" disabled={create.isPending || username.trim().length < 3}>
            {create.isPending && <LoaderCircle className="animate-spin" />}
            {t('submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
