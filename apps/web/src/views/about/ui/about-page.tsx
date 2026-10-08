import { useTranslations } from 'next-intl';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { SectionTitle } from '@/shared/ui/section-title';
import { Architecture } from '@/widgets/architecture';
import { AuthorCard } from '@/widgets/author-card';

const STACK = {
  backend: ['NestJS 11', 'Kafka (KRaft)', 'RabbitMQ 4', 'PostgreSQL 17', 'kafkajs', 'amqplib', 'Transactional outbox'],
  frontend: ['Next.js 16', 'React 19', 'TypeScript', 'Feature-Sliced Design', 'TanStack Query', 'Zustand', 'Tailwind CSS 4', 'shadcn/ui', 'next-intl', 'SSE'],
  infra: ['Docker Compose', 'pnpm workspaces', 'Kafka UI', 'RabbitMQ Management'],
} as const;

export function AboutPage() {
  const t = useTranslations('about');
  return (
    <div className="grid gap-8">
      <SectionTitle title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-5 md:grid-cols-2">
        {(['kafka', 'rabbit'] as const).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-lg">{t(`why.${key}.title`)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {(['a', 'b', 'c'] as const).map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {t(`why.${key}.${p}`)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="grid gap-4">
        <h2 className="font-display text-xl font-bold">{t('architecture.title')}</h2>
        <Architecture />
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-xl font-bold">{t('stack.title')}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {(Object.keys(STACK) as Array<keyof typeof STACK>).map((group) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{t(`stack.${group}`)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5 pt-3">
                {STACK[group].map((item) => (
                  <Badge key={item} variant="muted" className="text-[11px]">
                    {item}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <AuthorCard />
    </div>
  );
}
