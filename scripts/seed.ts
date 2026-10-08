/**
 * Сидер базовых данных: игроки с разным поведением + стартовые депозиты.
 *
 *   pnpm seed               # 60 случайных игроков + 3 демо-игрока
 *   pnpm seed players=200
 *   pnpm seed ifEmpty=1     # только если игроков ещё нет (так запускается в docker compose)
 *
 * Детерминированный (faker.seed): каждый запуск даёт тех же игроков с теми же id.
 * ВНИМАНИЕ: очищает таблицы. История событий в Kafka при этом остаётся —
 * для полностью чистого старта: pnpm infra:reset → infra:up → infra:setup → seed.
 *
 * Стартовые балансы пишутся прямо в БД (это "миграция данных", а не события).
 * Живая история ставок появится, когда запустишь `pnpm simulate`.
 */
import { faker } from '@faker-js/faker';
import { Client } from 'pg';
import { config, TRUNCATE_ALL_SQL } from '@app/common';
import { arg, DEMO_PLAYERS, Persona, PERSONAS, roundTo } from './personas';

const PLAYERS = arg('players', 60);
const IF_EMPTY = arg('ifEmpty', 0) === 1;

function choosePersonas(count: number): Persona[] {
  const list: Persona[] = [];
  // Гарантируем минимум каждого типа — чтобы все правила антифрода было на ком проверить
  for (const [persona, cfg] of Object.entries(PERSONAS) as Array<[Persona, (typeof PERSONAS)[Persona]]>) {
    for (let i = 0; i < cfg.min && list.length < count; i++) list.push(persona);
  }
  const weighted = Object.entries(PERSONAS).flatMap(([p, cfg]) => Array<Persona>(cfg.weight).fill(p as Persona));
  while (list.length < count) list.push(faker.helpers.arrayElement(weighted));
  return faker.helpers.shuffle(list);
}

/** Разбить сумму на 1–3 депозита, разнесённых во времени */
function splitDeposits(total: number, from: Date): Array<{ amount: number; at: Date }> {
  if (total <= 0) return [];
  const parts = total >= 3_000 ? faker.number.int({ min: 1, max: 3 }) : 1;
  const result: Array<{ amount: number; at: Date }> = [];
  let left = total;
  let at = from;
  for (let i = 0; i < parts; i++) {
    const amount = i === parts - 1 ? left : roundTo(left * faker.number.float({ min: 0.3, max: 0.6 }), 10);
    left -= amount;
    result.push({ amount, at });
    at = faker.date.between({ from: at, to: new Date() });
  }
  return result;
}

async function insertPlayer(
  c: Client,
  p: { id: string; username: string; email: string; country: string; persona: string; createdAt: Date; deposits: Array<{ amount: number; at: Date }> },
) {
  const balance = p.deposits.reduce((s, d) => s + d.amount, 0);
  await c.query(
    `INSERT INTO wallet.players (id, username, email, country, persona, balance, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [p.id, p.username, p.email, p.country, p.persona, balance, p.createdAt],
  );
  let running = 0;
  for (const d of p.deposits) {
    running += d.amount;
    await c.query(
      `INSERT INTO wallet.transactions (player_id, type, amount, balance_after, ref_id, created_at)
       VALUES ($1, 'deposit', $2, $3, $4, $5)`,
      [p.id, d.amount, running, `seed-${faker.string.uuid()}`, d.at],
    );
  }
  return balance;
}

(async () => {
  faker.seed(42);
  const c = new Client({ connectionString: config.databaseUrl });
  await c.connect();

  // ifEmpty=1 — режим для docker compose: сидим только в пустую базу, повторный `up` данные не трогает
  if (IF_EMPTY) {
    const { rows } = await c.query(`SELECT count(*)::int AS n FROM wallet.players`);
    if (rows[0].n > 0) {
      console.log(`ℹ️  В базе уже ${rows[0].n} игроков — seed пропущен (ifEmpty=1)`);
      await c.end();
      return;
    }
  }

  try {
    await c.query(TRUNCATE_ALL_SQL);
  } catch (e: any) {
    if (e.code === '42P01') {
      console.error('❌ Таблиц нет — сначала выполни: pnpm infra:setup');
      process.exit(1);
    }
    throw e;
  }

  await c.query('BEGIN');
  const summary = new Map<string, { players: number; chips: number }>();
  const add = (persona: string, chips: number) => {
    const s = summary.get(persona) ?? { players: 0, chips: 0 };
    s.players++;
    s.chips += chips;
    summary.set(persona, s);
  };

  for (const d of DEMO_PLAYERS) {
    const chips = await insertPlayer(c, {
      ...d,
      country: 'RU',
      persona: 'demo',
      createdAt: new Date(),
      deposits: [{ amount: d.balance, at: new Date() }],
    });
    add('demo', chips);
  }

  const usernames = new Set<string>(DEMO_PLAYERS.map((d) => d.username));
  for (const persona of choosePersonas(PLAYERS)) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let username = faker.internet
      .username({ firstName, lastName })
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (persona === 'bot') username = `${username.slice(0, 10)}_bot${faker.number.int(99)}`;
    while (usernames.has(username)) username += faker.number.int(9);
    usernames.add(username);

    const cfg = PERSONAS[persona];
    const createdAt = faker.date.recent({ days: 90 });
    const total = cfg.deposit[1] ? roundTo(faker.number.int({ min: cfg.deposit[0], max: cfg.deposit[1] }), 10) : 0;

    const chips = await insertPlayer(c, {
      id: faker.string.uuid(),
      username,
      email: faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
      country: faker.location.countryCode('alpha-2'),
      persona,
      createdAt,
      deposits: splitDeposits(total, createdAt),
    });
    add(persona, chips);
  }
  await c.query('COMMIT');

  console.log(`\n✅ Создано игроков: ${PLAYERS} + ${DEMO_PLAYERS.length} демо\n`);
  console.table(
    [...summary.entries()].map(([persona, s]) => ({
      persona,
      players: s.players,
      'фишек всего': s.chips,
      поведение: persona === 'demo' ? 'для ручных запросов (requests.http)' : PERSONAS[persona as Persona].description,
    })),
  );
  console.log('\nДемо-игроки (их id уже прописаны в requests.http):');
  console.table(DEMO_PLAYERS.map((d) => ({ username: d.username, id: d.id, balance: d.balance })));
  console.log('Дальше: pnpm dev (сервисы) → pnpm simulate (живой трафик)\n');
  await c.end();
})().catch((e) => {
  console.error('❌ Seed упал. PostgreSQL поднят? (pnpm infra:up && pnpm infra:setup)\n', e);
  process.exit(1);
});
