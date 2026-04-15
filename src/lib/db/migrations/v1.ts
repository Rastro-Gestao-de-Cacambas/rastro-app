/**
 * Migração inicial: meta, snapshot de ordens, outbox.
 * Atualiza PRAGMA user_version para 1.
 */
export const MIGRATION_V1_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT NOT NULL PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_orders_updated_at ON work_orders(updated_at);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT NOT NULL PRIMARY KEY,
  type TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_sequence ON outbox(status, sequence);
CREATE INDEX IF NOT EXISTS idx_outbox_work_order_id ON outbox(work_order_id);

PRAGMA user_version = 1;
`;

export const MIGRATION_V1_VERSION = 1;
