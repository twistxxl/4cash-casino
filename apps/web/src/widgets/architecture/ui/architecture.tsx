import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

const SERVICES = [
  { id: 'gateway', brokers: ['HTTP', 'SSE', 'Kafka', 'RabbitMQ'] },
  { id: 'wallet', brokers: ['Kafka', 'RabbitMQ', 'PostgreSQL'] },
  { id: 'roulette', brokers: ['Kafka', 'PostgreSQL'] },
  { id: 'crash', brokers: ['Kafka', 'RabbitMQ', 'PostgreSQL'] },
  { id: 'risk', brokers: ['Kafka', 'RabbitMQ'] },
  { id: 'leaderboard', brokers: ['Kafka'] },
  { id: 'payments', brokers: ['RabbitMQ'] },
  { id: 'notifications', brokers: ['RabbitMQ'] },
] as const;

const BROKER_TONE: Record<string, string> = {
  Kafka: 'bg-primary/12 text-primary',
  RabbitMQ: 'bg-warn/16 text-warn',
  PostgreSQL: 'bg-accent/15 text-accent',
  HTTP: 'bg-foreground/[0.07] text-muted-foreground',
  SSE: 'bg-win/14 text-win',
};

const FLOW = [
  { step: 'placed', topic: 'bets.placed' },
  { step: 'accepted', topic: 'bets.accepted' },
  { step: 'played', topic: 'bets.settled' },
  { step: 'paid', topic: 'wallet.transactions' },
  { step: 'live', topic: 'SSE → UI' },
] as const;

export function Architecture() {
  const t = useTranslations('about.architecture');
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('flowTitle')}</CardTitle>
          <CardDescription>{t('flowText')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-5">
            {FLOW.map(({ step, topic }, i) => (
              <li key={step} className="relative grid gap-2 rounded-2xl bg-foreground/[0.04] p-4">
                <span className="font-display text-2xl font-bold text-primary/70">{i + 1}</span>
                <span className="text-sm font-semibold">{t(`flow.${step}`)}</span>
                <code className="w-fit rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">{topic}</code>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map(({ id, brokers }) => (
          <Card key={id} className="rounded-2xl">
            <CardContent className="grid gap-2.5 p-4 sm:p-4">
              <p className="font-mono text-sm font-semibold">{id}-service</p>
              <p className="text-sm text-muted-foreground">{t(`services.${id}`)}</p>
              <div className="flex flex-wrap gap-1">
                {brokers.map((b) => (
                  <Badge key={b} className={cn('text-[10px]', BROKER_TONE[b])}>
                    {b}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
