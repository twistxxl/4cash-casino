import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

/**
 * Тонкая обёртка над pg.Pool. Без ORM — чтобы SQL (и блокировки, и транзакции) были на виду.
 * Все сервисы ходят в одну БД, но каждый — в свою схему (wallet / games / risk).
 */
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

  query<T extends QueryResultRow = any>(sql: string, params?: unknown[]) {
    return this.pool.query<T>(sql, params);
  }

  /** BEGIN → fn → COMMIT, при ошибке ROLLBACK */
  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
