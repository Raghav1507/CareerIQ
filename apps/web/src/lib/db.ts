import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { getServerEnv } from "@/lib/env";

/**
 * Server-side PostgreSQL access.
 *
 * The pool connects with DATABASE_URL (owner credentials) and every query in
 * the application filters by user_id — authorisation is enforced in code and
 * again by Row Level Security for any direct PostgREST access.
 */

const globalForPg = globalThis as unknown as { __careeriqPool?: Pool };

function createPool(): Pool {
  const env = getServerEnv();
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: env.DATABASE_URL.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

export function getPool(): Pool {
  if (!globalForPg.__careeriqPool) {
    globalForPg.__careeriqPool = createPool();
    if (process.env.NODE_ENV !== "production") {
      // Avoid exhausting connections during Next.js hot reload.
      globalForPg.__careeriqPool.on("error", (err) => {
        console.error("[db] unexpected pool error", err.message);
      });
    }
  }
  return globalForPg.__careeriqPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as never);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Cheap liveness probe used by /api/health. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; version?: string; error?: string }> {
  const started = Date.now();
  try {
    const row = await queryOne<{ version: string }>("select version() as version");
    return { ok: true, latencyMs: Date.now() - started, version: row?.version };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}
