#!/usr/bin/env node
/**
 * CareerIQ migration runner (cross-platform: Windows / macOS).
 *
 * Applies supabase/migrations/*.sql in lexical order using DATABASE_URL.
 * Tracks applied migrations in `_migrations` so re-runs are safe.
 *
 * Usage:
 *   node scripts/migrate.mjs            apply pending migrations
 *   node scripts/migrate.mjs --reset    drop public schema, then apply all
 *   node scripts/migrate.mjs --status   list applied / pending
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* no env file -> rely on process env */
  }
}

loadEnvFile(resolve(__dirname, '..', '.env'));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const reset = args.has('--reset');
const statusOnly = args.has('--status');

function listFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log(`[migrate] connected -> ${DATABASE_URL.replace(/:[^:@/]*@/, ':***@')}`);

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now(),
      checksum text not null
    );
  `);

  // If the Supabase CLI already applied these files (it tracks them in
  // supabase_migrations.schema_migrations), import that history so we never
  // apply the same migration twice.
  const supaTracked = await client.query(`
    select to_regclass('supabase_migrations.schema_migrations') is not null as exists
  `);
  if (supaTracked.rows[0].exists) {
    const names = await client.query(
      `select name from supabase_migrations.schema_migrations`
    );
    // Supabase CLI stores names like "core_schema" while files are named
    // "20261110000002_core_schema.sql" -> match on the normalized suffix.
    const normalize = (n) => String(n).split(/[\\/]/).pop().replace(/^\d+_/, '').replace(/\.sql$/, '');
    const localByNorm = new Map(listFiles().map((f) => [normalize(f), f]));
    for (const row of names.rows) {
      const local = localByNorm.get(normalize(row.name));
      if (local) {
        await client.query(
          `insert into _migrations (name, checksum) values ($1, 'supabase-cli')
           on conflict (name) do nothing`,
          [local]
        );
      }
    }
  }

  if (reset) {
    console.log('[migrate] --reset: dropping schema public ...');
    await client.query('drop schema if exists public cascade;');
    await client.query('drop table if exists _migrations cascade;');
    await client.query('create schema public;');
    // Clear our shim's auth.users only (never Supabase's real auth schema).
    const isShim = await client.query(`
      select not exists (
        select 1 from information_schema.columns
         where table_schema = 'auth' and table_name = 'users'
           and column_name = 'confirmation_token'
      ) as is_shim
    `);
    if (isShim.rows[0].is_shim) {
      await client.query('truncate table auth.users restart identity cascade;');
    }
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now(),
        checksum text not null
      );
    `);
    console.log('[migrate] schema dropped');
  }

  const appliedRes = await client.query('select name from _migrations');
  const applied = new Set(appliedRes.rows.map((r) => r.name));
  const files = listFiles();
  let pending = 0;

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = (await import('node:crypto')).createHash('sha256').update(sql).digest('hex').slice(0, 16);

    if (applied.has(file)) {
      console.log(`[migrate] skip (applied) ${file}`);
      continue;
    }
    if (statusOnly) {
      console.log(`[migrate] PENDING  ${file}`);
      pending++;
      continue;
    }

    console.log(`[migrate] applying ${file} ...`);
    const started = Date.now();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name, checksum) values ($1, $2)', [file, checksum]);
      await client.query('commit');
      console.log(`[migrate]   ok (${Date.now() - started} ms)`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.error(`[migrate]   FAILED on ${file}:`);
      console.error(err.message);
      await client.end();
      process.exit(1);
    }
    pending++;
  }

  if (statusOnly) {
    console.log(`[migrate] ${files.length - pending} applied, ${pending} pending`);
  } else {
    const counts = await client.query(`
      select
        (select count(*) from public.career_roles)   as roles,
        (select count(*) from public.skills)         as skills,
        (select count(*) from public.skill_aliases)  as aliases,
        (select count(*) from public.role_skills)    as role_skills
    `);
    const c = counts.rows[0];
    console.log(
      `[migrate] done. seeded -> roles: ${c.roles}, skills: ${c.skills}, aliases: ${c.aliases}, role_skills: ${c.role_skills}`
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error('[migrate] error:', err.message);
  process.exit(1);
});
