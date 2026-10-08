/**
 * Схема БД. Применяется `npm run setup` (идемпотентно).
 * Принцип "database per service" упрощён до "schema per service":
 *   wallet.* — только wallet-service, games.* — roulette/crash, risk.* — risk-service.
 */
export const SCHEMA_SQL = /* sql */ `
CREATE SCHEMA IF NOT EXISTS wallet;

CREATE TABLE IF NOT EXISTS wallet.players (
  id          uuid PRIMARY KEY,
  username    text UNIQUE NOT NULL,
  email       text NOT NULL,
  country     text NOT NULL,
  persona     text,                                   -- поведение в симуляторе (casual, bot, ...)
  status      text NOT NULL DEFAULT 'active',         -- active | blocked
  balance     integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Журнал движения денег. UNIQUE (type, ref_id) = идемпотентность:
-- один и тот же выигрыш по ставке нельзя зачислить дважды, даже если событие пришло повторно.
CREATE TABLE IF NOT EXISTS wallet.transactions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id      uuid NOT NULL REFERENCES wallet.players(id),
  type           text NOT NULL,
  amount         integer NOT NULL,
  balance_after  integer NOT NULL,
  ref_id         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, ref_id)
);
CREATE INDEX IF NOT EXISTS transactions_player ON wallet.transactions (player_id, id DESC);

CREATE TABLE IF NOT EXISTS wallet.bets (
  id             uuid PRIMARY KEY,
  player_id      uuid NOT NULL,
  game           text NOT NULL,
  amount         integer NOT NULL,
  selection      jsonb NOT NULL,
  status         text NOT NULL,                       -- accepted | rejected | settled
  reject_reason  text,
  payout         integer,
  outcome        text,
  result         jsonb,
  placed_at      timestamptz NOT NULL,
  settled_at     timestamptz
);
CREATE INDEX IF NOT EXISTS bets_player ON wallet.bets (player_id);

CREATE TABLE IF NOT EXISTS wallet.withdrawals (
  id          uuid PRIMARY KEY,
  player_id   uuid NOT NULL REFERENCES wallet.players(id),
  amount      integer NOT NULL,
  status      text NOT NULL,                          -- pending | completed | failed
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Transactional outbox: событие пишется в ТУ ЖЕ транзакцию, что и изменение баланса,
-- а отдельный relay потом публикует его в Kafka/RabbitMQ.
CREATE TABLE IF NOT EXISTS wallet.outbox (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  destination   text NOT NULL,                        -- kafka | rabbit
  target        text NOT NULL,                        -- топик или exchange ('' = default exchange)
  key           text NOT NULL,                        -- ключ сообщения Kafka или routing key RabbitMQ
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_unpublished ON wallet.outbox (id) WHERE published_at IS NULL;

CREATE SCHEMA IF NOT EXISTS games;

CREATE TABLE IF NOT EXISTS games.roulette_spins (
  bet_id      uuid PRIMARY KEY,
  player_id   uuid NOT NULL,
  username    text NOT NULL,
  amount      integer NOT NULL,
  selection   jsonb NOT NULL,
  number      integer NOT NULL,
  color       text NOT NULL,
  won         boolean NOT NULL,
  payout      integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games.crash_rounds (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status             text NOT NULL,                   -- betting | running | crashed | cancelled
  crash_point        double precision NOT NULL,
  betting_opened_at  timestamptz NOT NULL DEFAULT now(),
  started_at         timestamptz,
  crashed_at         timestamptz
);

CREATE TABLE IF NOT EXISTS games.crash_bets (
  bet_id         uuid PRIMARY KEY,
  round_id       integer REFERENCES games.crash_rounds(id),  -- NULL пока ждёт следующего раунда
  player_id      uuid NOT NULL,
  username       text NOT NULL,
  amount         integer NOT NULL,
  auto_cashout   double precision,
  cashed_out_at  double precision,
  status         text NOT NULL,                       -- pending | active | won | lost | refunded
  payout         integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crash_bets_round ON games.crash_bets (round_id);

CREATE SCHEMA IF NOT EXISTS risk;

CREATE TABLE IF NOT EXISTS risk.alerts (
  id           uuid PRIMARY KEY,
  player_id    uuid NOT NULL,
  username     text NOT NULL,
  rule         text NOT NULL,
  severity     text NOT NULL,
  action       text NOT NULL,
  details      jsonb NOT NULL,
  detected_at  timestamptz NOT NULL
);
`;

export const TRUNCATE_ALL_SQL = /* sql */ `
TRUNCATE wallet.outbox, wallet.transactions, wallet.withdrawals, wallet.bets, wallet.players,
         games.crash_bets, games.crash_rounds, games.roulette_spins, risk.alerts
RESTART IDENTITY CASCADE;
`;
