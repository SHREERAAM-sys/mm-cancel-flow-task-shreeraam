// src/lib/pg.ts
// Minimal Postgres client like your Supabase setup, with helpers to
// set session user (for auth.uid() shim) and run queries/rpc calls.

import { Pool, PoolClient, QueryResult } from 'pg';

const pgUrl = process.env.POSTGRES_URL!;
const pgServiceUrl = process.env.POSTGRES_SERVICE_URL!;

// App/user-scoped pool (subject to RLS)
export const pg = new Pool({ connectionString: pgUrl });

// Admin/service pool (bypasses RLS if the role has BYPASSRLS or owner)
export const pgAdmin = new Pool({ connectionString: pgServiceUrl });

// Basic query helper (uses user pool)
export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pg.query<T>(text, params);
}

// Call a SQL function (RPC style) with positional args
export async function rpc<T = any>(fn: string, args: any[] = []): Promise<QueryResult<T>> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return query<T>(`SELECT * FROM ${fn}(${placeholders});`, args);
}

// --- Session helpers (for your auth.uid() shim pointing to current.user_id) ---

/**
 * Sets current.user_id for this client session so RLS/auth.uid() works.
 * Call inside a transaction (BEGIN .. COMMIT).
 */
export async function setSessionUser(client: PoolClient, userId: string | null) {
  await client.query(
    `SELECT set_config('current.user_id', $1, true);`,
    [userId ?? '']
  );
}

/**
 * Optional flag to allow temporary bootstrap reads (if you added that policy).
 */
export async function setBootstrapFlag(client: PoolClient, on: boolean) {
  await client.query(
    `SELECT set_config('current.bootstrap', $1, true);`,
    [on ? 'on' : '']
  );
}

/**
 * Convenience: run a unit of work as a given user (transactional).
 * Automatically BEGINs, sets current.user_id, runs fn, and COMMITs/ROLLBACKs.
 */
export async function runAsUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await setSessionUser(client, userId);
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

/**
 * Run arbitrary work with an admin client (transactional).
 */
export async function runAsAdmin<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pgAdmin.connect();
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
