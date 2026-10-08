/** Адрес API gateway, по которому ходит браузер. Встраивается в бандл при сборке */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const AUTHOR = {
  telegram: 'm42dev',
  telegramUrl: 'https://t.me/m42dev',
} as const;

/** Должно совпадать с GROWTH в apps/crash-service/src/crash.engine.ts — фронт сам рисует кривую множителя */
export const CRASH_GROWTH = 0.00008;

export const DEMO_PLAYER_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;
