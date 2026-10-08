import { randomUUID } from 'crypto';
import { sleep } from '@app/common';

export type ProviderResponse =
  | { kind: 'ok'; providerRef: string }
  | { kind: 'transient'; error: string } //  временная ошибка — имеет смысл повторить
  | { kind: 'declined'; error: string }; //  бизнес-отказ — повторять бессмысленно

/**
 * Заглушка платёжного провайдера. Настраивается через env:
 *   PROVIDER_FAIL_RATE=0.25   доля временных ошибок (таймаут, 503)
 *   PROVIDER_DECLINE_RATE=0.05 доля отказов (карта заблокирована)
 *   PROVIDER_DOWN=1           провайдер лежит: все запросы — временная ошибка
 */
export async function transfer(amount: number): Promise<ProviderResponse> {
  const failRate = Number(process.env.PROVIDER_FAIL_RATE ?? 0.25);
  const declineRate = Number(process.env.PROVIDER_DECLINE_RATE ?? 0.05);

  await sleep(300 + Math.random() * 1200); // сетевая задержка

  if (process.env.PROVIDER_DOWN === '1') return { kind: 'transient', error: 'PROVIDER_UNAVAILABLE' };
  const r = Math.random();
  if (r < declineRate) return { kind: 'declined', error: amount > 50_000 ? 'LIMIT_EXCEEDED' : 'CARD_DECLINED' };
  if (r < declineRate + failRate) return { kind: 'transient', error: Math.random() < 0.5 ? 'TIMEOUT' : 'HTTP_503' };
  return { kind: 'ok', providerRef: `PAY-${randomUUID().slice(0, 8).toUpperCase()}` };
}
