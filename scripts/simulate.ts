/**
 * Симулятор живого трафика: каждый игрок из БД играет по своему "характеру" (persona)
 * через настоящий HTTP API gateway — то есть через всю цепочку Kafka/RabbitMQ.
 *
 *   pnpm simulate                          # 2 минуты, все игроки
 *   pnpm simulate duration=0               # пока не нажмёшь Ctrl+C
 *   pnpm simulate speed=3                  # в 3 раза чаще
 *   pnpm simulate personas=bot,martingale  # только выбранные типы
 *   pnpm simulate players=10               # только 10 случайных игроков
 */
import { Client } from 'pg';
import { config, sleep } from '@app/common';
import { arg, pick, Persona, PERSONAS, rand, randInt, roundTo, strArg } from './personas';

const DURATION_SEC = arg('duration', 120);
const SPEED = Math.max(0.1, arg('speed', 1));
const PLAYER_LIMIT = arg('players', 0);
// PowerShell превращает `a,b` в массив и передаёт "a b" — поэтому делим и по запятым, и по пробелам
const ONLY = strArg('personas')?.split(/[,\s]+/).filter(Boolean) as Persona[] | undefined;

interface Sim {
  id: string;
  username: string;
  persona: Persona;
  balance: number;
  status: string;
}

// ---------------- инфраструктура ----------------

const stopAt = DURATION_SEC ? Date.now() + DURATION_SEC * 1000 : Infinity;
let stopping = false;
process.on('SIGINT', () => {
  if (stopping) process.exit(1);
  stopping = true;
  console.log('\n⏹  останавливаюсь (ещё раз Ctrl+C — выйти сразу)...');
});
const alive = () => !stopping && Date.now() < stopAt;

/** Пауза с учётом speed, которая прерывается, когда время симуляции вышло */
async function wait(minMs: number, maxMs: number) {
  const until = Date.now() + rand(minMs, maxMs) / SPEED;
  while (alive() && Date.now() < until) await sleep(Math.min(250, until - Date.now()));
}

const counters = new Map<string, number>();
const errors = new Map<string, number>();
const inc = (key: string, map = counters) => map.set(key, (map.get(key) ?? 0) + 1);

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(config.gatewayUrl + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(json.message) ? json.message.join(', ') : (json.message ?? res.statusText);
    throw new ApiError(res.status, String(message));
  }
  return json;
}

/** Ошибка не роняет игрока — считаем и продолжаем */
async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof ApiError ? `${e.status} ${e.message.split(':')[0]}` : (e as Error).message;
    inc(msg.slice(0, 60), errors);
    return undefined;
  }
}

// ---------------- действия игрока ----------------

async function refresh(p: Sim) {
  const r = await api('GET', `/players/${p.id}`);
  p.balance = r.balance;
  if (p.status !== r.status && r.status === 'blocked') {
    console.log(`  ⛔ ${p.username} (${p.persona}) заблокирован антифродом`);
    inc('blocked players');
  }
  p.status = r.status;
}

async function ensureFunds(p: Sim, need: number) {
  if (p.balance >= need) return;
  await attempt(() => refresh(p));
  const cfg = PERSONAS[p.persona];
  if (p.balance >= need || !cfg.topUpBelow) return;
  const amount = roundTo(rand(cfg.deposit[0], cfg.deposit[1]) * 0.5, 10);
  const r = await attempt(() => api('POST', `/players/${p.id}/deposit`, { amount }));
  if (r) {
    p.balance = r.balance;
    inc('deposits');
  }
}

async function roulette(p: Sim, amount: number, selection: Record<string, unknown>) {
  const r = await attempt(() => api('POST', '/bets/roulette', { playerId: p.id, amount, selection }));
  if (r) {
    p.balance -= amount;
    inc('bets: roulette');
  }
  return r?.betId as string | undefined;
}

async function crash(p: Sim, amount: number, autoCashout?: number) {
  const r = await attempt(() => api('POST', '/bets/crash', { playerId: p.id, amount, autoCashout }));
  if (r) {
    p.balance -= amount;
    inc('bets: crash');
  }
  return r?.betId as string | undefined;
}

/** Ждём, пока ставка пройдёт всю цепочку (Kafka → wallet → игра → Kafka → wallet) */
async function waitBet(betId: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && alive()) {
    const bet = await attempt(() => api('GET', `/bets/${betId}`));
    if (bet && (bet.status === 'settled' || bet.status === 'rejected')) return bet;
    await sleep(250);
  }
  inc('bet wait timeout', errors);
  return undefined;
}

async function withdraw(p: Sim, amount: number) {
  const r = await attempt(() => api('POST', `/players/${p.id}/withdraw`, { amount }));
  if (r) {
    p.balance = r.balance;
    inc('withdrawals');
  }
}

const EVEN_MONEY = ['red', 'black', 'even', 'odd', 'low', 'high'] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------- характеры ----------------

const behaviours: Record<Persona, (p: Sim) => Promise<void>> = {
  async casual(p) {
    while (alive()) {
      await wait(3_000, 8_000);
      await ensureFunds(p, 50);
      if (Math.random() < 0.8) await roulette(p, pick([10, 20, 25, 50]), { type: pick(EVEN_MONEY) });
      else await crash(p, pick([10, 20, 30]), round2(rand(1.5, 2.5)));
    }
  },

  async regular(p) {
    for (let i = 0; alive(); i++) {
      await wait(1_000, 3_000);
      if (i % 15 === 0) await attempt(() => refresh(p));
      await ensureFunds(p, 200);
      const r = Math.random();
      if (r < 0.35) await crash(p, roundTo(rand(20, 200), 10), round2(rand(1.3, 5)));
      else if (r < 0.65) await roulette(p, roundTo(rand(20, 200), 10), { type: pick(EVEN_MONEY) });
      else if (r < 0.85) await roulette(p, roundTo(rand(20, 100), 10), { type: 'dozen', dozen: randInt(1, 3) });
      else await roulette(p, roundTo(rand(10, 50), 5), { type: 'straight', number: randInt(0, 36) });

      if (Math.random() < 0.03 && p.balance > 5_000) await withdraw(p, roundTo(p.balance * 0.3, 10));
    }
  },

  async highroller(p) {
    for (let i = 0; alive(); i++) {
      await wait(3_000, 6_000);
      if (i % 10 === 0) await attempt(() => refresh(p));
      await ensureFunds(p, 10_000);
      const r = Math.random();
      if (r < 0.3) await crash(p, roundTo(rand(2_000, 10_000), 100), round2(rand(1.5, 10)));
      else if (r < 0.6) await roulette(p, roundTo(rand(500, 2_000), 100), { type: 'straight', number: randInt(0, 36) });
      else await roulette(p, roundTo(rand(2_000, 10_000), 100), { type: pick(EVEN_MONEY) });

      if (Math.random() < 0.03 && p.balance > 60_000) await withdraw(p, roundTo(rand(20_000, 50_000), 1_000));
    }
  },

  /** Удваивает ставку после проигрыша — для этого ждёт результат каждой ставки */
  async martingale(p) {
    const base = 10;
    let stake = base;
    while (alive()) {
      await wait(800, 1_500);
      await ensureFunds(p, stake);
      if (p.balance < stake || stake > 2_560) stake = base;
      const betId = await roulette(p, stake, { type: 'red' });
      if (!betId) continue;
      const bet = await waitBet(betId);
      if (bet?.status === 'settled') {
        stake = bet.outcome === 'loss' ? stake * 2 : base;
        if (bet.payout) p.balance += bet.payout;
      } else {
        stake = base;
        await attempt(() => refresh(p));
      }
    }
  },

  /** Ставит в фазе приёма ставок и сам жмёт "забрать" на выбранном множителе */
  async crash_lover(p) {
    while (alive()) {
      const s = await attempt(() => api('GET', '/crash'));
      if (!s || s.phase !== 'betting' || s.bettingEndsInMs < 1_500) {
        await sleep(500);
        continue;
      }
      await ensureFunds(p, 100);
      const target = round2(Math.random() < 0.6 ? rand(1.2, 2.5) : rand(2.5, 8));
      const betId = await crash(p, roundTo(rand(20, 300), 10));
      if (!betId) continue;

      // Следим за раундом. Ставка идёт через Kafka и может не успеть в этот раунд — тогда сыграет в следующем.
      const deadline = Date.now() + 90_000;
      let flying = false;
      while (Date.now() < deadline && alive()) {
        await sleep(150);
        const st = await attempt(() => api('GET', '/crash'));
        if (!st) continue;
        const mine = st.bets?.find((b: any) => b.playerId === p.id && b.cashedOutAt === null);
        if (st.phase === 'running' && mine) {
          flying = true;
          if (st.multiplier >= target) {
            const r = await attempt(() => api('POST', '/crash/cashout', { playerId: p.id }));
            if (r) inc('crash: manual cashouts');
            break;
          }
        } else if (flying) {
          inc('crash: busted'); // разбился раньше цели
          break;
        }
      }
      await wait(1_000, 3_000);
    }
  },

  async bot(p) {
    for (let i = 0; alive(); i++) {
      await wait(200, 400);
      if (i % 40 === 0) await attempt(() => refresh(p));
      if (p.status === 'blocked') {
        await wait(5_000, 8_000); // заблокированный бот долбится реже — ставки будут rejected
      }
      await ensureFunds(p, 10);
      await roulette(p, randInt(1, 5), { type: pick(['even', 'odd'] as const) });
    }
  },

  /** Внёс → чуть-чуть поиграл → вывел почти всё */
  async bonus_abuser(p) {
    while (alive()) {
      await wait(2_000, 6_000);
      const deposit = roundTo(rand(1_000, 3_000), 100);
      const r = await attempt(() => api('POST', `/players/${p.id}/deposit`, { amount: deposit }));
      if (!r) continue;
      inc('deposits');
      await wait(3_000, 8_000);
      for (let i = randInt(1, 2); i > 0; i--) await roulette(p, roundTo(rand(10, 30), 5), { type: pick(EVEN_MONEY) });
      await wait(2_000, 4_000);
      await attempt(() => refresh(p));
      if (p.balance > 100) await withdraw(p, Math.min(p.balance, roundTo(deposit * 0.9, 10)));
      await wait(30_000, 60_000);
    }
  },
};

// ---------------- запуск ----------------

function printStats(started: number) {
  const sec = Math.round((Date.now() - started) / 1000);
  const parts = [...counters.entries()].map(([k, v]) => `${k}: ${v}`).join(' | ');
  const errTotal = [...errors.values()].reduce((a, b) => a + b, 0);
  console.log(`⏱  ${sec}s | ${parts || 'разгоняемся...'}${errTotal ? ` | ошибок: ${errTotal}` : ''}`);
}

(async () => {
  try {
    await api('GET', '/crash');
  } catch (e) {
    console.error(`❌ Gateway (${config.gatewayUrl}) или crash-service недоступен — запусти сервисы: pnpm dev\n`, (e as Error).message);
    process.exit(1);
  }

  const db = new Client({ connectionString: config.databaseUrl });
  await db.connect();
  const { rows } = await db.query(
    `SELECT id, username, persona, balance, status FROM wallet.players
     WHERE persona IS NOT NULL AND persona <> 'demo' AND ($1::text[] IS NULL OR persona = ANY($1))
     ORDER BY random() LIMIT $2`,
    [ONLY ?? null, PLAYER_LIMIT || 10_000],
  );
  await db.end();
  if (!rows.length) {
    console.error('❌ Нет игроков — сначала pnpm seed');
    process.exit(1);
  }

  const byPersona = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.persona]: (acc[r.persona] ?? 0) + 1 }), {});
  console.log(
    `🎰 Симуляция: ${rows.length} игроков ${JSON.stringify(byPersona)}, ` +
      `${DURATION_SEC ? `${DURATION_SEC}с` : 'до Ctrl+C'}, скорость x${SPEED}\n`,
  );

  const started = Date.now();
  const ticker = setInterval(() => printStats(started), 10_000);

  await Promise.all(
    (rows as Sim[]).map(async (p) => {
      await sleep(Math.random() * 3_000); // не стартуем все одновременно
      await behaviours[p.persona](p).catch((e) => inc(`crash in ${p.persona}: ${(e as Error).message}`, errors));
    }),
  );

  clearInterval(ticker);
  printStats(started);
  if (errors.size) {
    console.log('\nОшибки (часть ожидаема: INSUFFICIENT_FUNDS, TOO_LATE, PLAYER_BLOCKED):');
    console.table([...errors.entries()].sort((a, b) => b[1] - a[1]).map(([error, count]) => ({ error, count })));
  }

  const board = await attempt(() => api('GET', '/leaderboard'));
  if (board && !board.error) {
    console.log('\n🏆 Leaderboard (собран leaderboard-service из Kafka):');
    console.table(board.topWinners?.slice(0, 5).map((r: any) => ({ username: r.username, bets: r.bets, net: r.net })));
    console.log('Игры:', JSON.stringify(board.games));
  }
  console.log('\nЗагляни: Kafka UI http://localhost:8080 · RabbitMQ http://localhost:15672 · Adminer http://localhost:8081');
})();
