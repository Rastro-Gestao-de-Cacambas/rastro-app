import type { SQLiteDatabase } from 'expo-sqlite';

import { queryFirst, run } from './wrapper';

/** Lê um valor da tabela `meta`. */
export async function getMeta(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await queryFirst<{ value: string }>(
    db,
    'SELECT value FROM meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

/** Define ou atualiza uma chave em `meta`. */
export async function setMeta(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await run(
    db,
    `INSERT INTO meta(key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
