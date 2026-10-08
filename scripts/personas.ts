/** Типы игроков. Сидер раздаёт их игрокам, симулятор по ним решает, как играть. */
export type Persona = 'casual' | 'regular' | 'highroller' | 'martingale' | 'crash_lover' | 'bot' | 'bonus_abuser';

export interface PersonaConfig {
  /** Вес при случайном выборе */
  weight: number;
  /** Сколько минимум таких игроков создаёт сидер */
  min: number;
  /** Стартовый баланс [min, max] */
  deposit: [number, number];
  /** Симулятор пополняет баланс, если он ниже этого (0 = никогда) */
  topUpBelow: number;
  description: string;
}

export const PERSONAS: Record<Persona, PersonaConfig> = {
  casual: {
    weight: 35,
    min: 3,
    deposit: [300, 2_000],
    topUpBelow: 50,
    description: 'Редко, мелкие ставки на цвет/чёт',
  },
  regular: {
    weight: 25,
    min: 3,
    deposit: [2_000, 10_000],
    topUpBelow: 300,
    description: 'Часто, рулетка + краш, иногда выводит',
  },
  highroller: {
    weight: 6,
    min: 2,
    deposit: [50_000, 200_000],
    topUpBelow: 10_000,
    description: 'Крупные ставки → BIG_WIN, push-уведомления',
  },
  martingale: {
    weight: 7,
    min: 2,
    deposit: [3_000, 8_000],
    topUpBelow: 300,
    description: 'Красное, удваивает после проигрыша → MARTINGALE',
  },
  crash_lover: {
    weight: 15,
    min: 3,
    deposit: [1_000, 8_000],
    topUpBelow: 100,
    description: 'Только краш, ручной кэшаут через RabbitMQ RPC',
  },
  bot: {
    weight: 4,
    min: 2,
    deposit: [5_000, 10_000],
    topUpBelow: 100,
    description: 'Ставки каждые 200–400мс → HIGH_FREQUENCY → блокировка',
  },
  bonus_abuser: {
    weight: 8,
    min: 2,
    deposit: [0, 0],
    topUpBelow: 0,
    description: 'Депозит → почти не играет → вывод → DEPOSIT_WITHDRAW',
  },
};

/** Фиксированные игроки для ручных запросов из requests.http. Симулятор их не трогает. */
export const DEMO_PLAYERS = [
  { id: '11111111-1111-4111-8111-111111111111', username: 'demo_alice', email: 'alice@demo.casino', balance: 10_000 },
  { id: '22222222-2222-4222-8222-222222222222', username: 'demo_bob', email: 'bob@demo.casino', balance: 250_000 },
  { id: '33333333-3333-4333-8333-333333333333', username: 'demo_broke', email: 'broke@demo.casino', balance: 30 },
];

export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
export const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

export function arg(name: string, def: number): number {
  const found = process.argv.find((a) => a.replace(/^-+/, '').startsWith(`${name}=`));
  return found ? Number(found.split('=')[1]) : def;
}

export function strArg(name: string): string | undefined {
  const found = process.argv.find((a) => a.replace(/^-+/, '').startsWith(`${name}=`));
  return found?.split('=')[1];
}
