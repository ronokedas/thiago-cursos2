import { Pool } from 'pg';
import fs from 'fs';
import type { DatabaseSchema } from './db.js';

const connectionString = process.env.DATABASE_URL || 'postgres://mecanica:mecanica_dev@localhost:5432/mecanica';
export const postgresPool = new Pool({ connectionString, max: 10 });

const schemaSql = `
CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS modules (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, title TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, module_id TEXT NOT NULL, title TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, module_id TEXT NOT NULL, title TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lesson_progress (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lesson_id TEXT NOT NULL, progress_percent NUMERIC NOT NULL DEFAULT 0, is_completed BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS system_settings (id TEXT PRIMARY KEY, payload JSONB NOT NULL);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_unique ON users (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_user_active_idx ON sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS lessons_module_idx ON lessons (module_id);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_progress_user_lesson_unique ON lesson_progress (user_id, lesson_id);
`;

let ready = false;
let persistenceQueue = Promise.resolve();

export async function initializePostgres(jsonFile: string): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await postgresPool.query(schemaSql);
      const current = await postgresPool.query<{ payload: DatabaseSchema }>('SELECT payload FROM app_state WHERE id = $1', ['main']);
      if (current.rowCount === 0) {
        let payload: DatabaseSchema | null = null;
        if (fs.existsSync(jsonFile)) {
          try { payload = JSON.parse(fs.readFileSync(jsonFile, 'utf8')) as DatabaseSchema; } catch { payload = null; }
        }
        if (payload) {
          await postgresPool.query('INSERT INTO app_state (id, payload) VALUES ($1, $2)', ['main', JSON.stringify(payload)]);
        }
      }
      ready = true;
      return;
    } catch (error) {
      if (attempt === 30) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export async function loadPostgresState(): Promise<DatabaseSchema | null> {
  if (!ready) return null;
  const result = await postgresPool.query<{ payload: DatabaseSchema }>('SELECT payload FROM app_state WHERE id = $1', ['main']);
  return result.rows[0]?.payload || null;
}

export function persistPostgresState(payload: DatabaseSchema): void {
  if (!ready) return;
  persistenceQueue = persistenceQueue.then(async () => {
    const client = await postgresPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO app_state (id, payload, updated_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()',
        ['main', JSON.stringify(payload)],
      );
      for (const user of payload.users) {
        await client.query(
          `INSERT INTO users (id, email, role, status, phone, cpf) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role, status=EXCLUDED.status, phone=EXCLUDED.phone, cpf=EXCLUDED.cpf`,
          [user.id, user.email, user.role, user.status, user.phone || null, user.cpf || null],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }).catch(error => {
    console.error('PostgreSQL state persistence failed:', error);
    throw error;
  });
}

export function waitForPostgresPersistence(): Promise<void> {
  return persistenceQueue.then(() => undefined);
}
