import type { SQLiteDatabase } from 'expo-sqlite';

import { SCHEMA_VERSION } from './constants';
import { MIGRATION_V1_SQL, MIGRATION_V1_VERSION } from './migrations/v1';

async function getUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
    [],
  );
  return row?.user_version ?? 0;
}

/**
 * Aplica migrações em sequência até `SCHEMA_VERSION`.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  let v = await getUserVersion(db);

  if (v < MIGRATION_V1_VERSION) {
    await db.execAsync(MIGRATION_V1_SQL);
    v = await getUserVersion(db);
  }

  if (v !== SCHEMA_VERSION) {
    throw new Error(
      `SQLite: esquema em versão ${v}, esperado ${SCHEMA_VERSION}. Migração em falta.`,
    );
  }
}
