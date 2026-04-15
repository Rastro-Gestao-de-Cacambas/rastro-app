import type {
  SQLiteBindParams,
  SQLiteDatabase,
  SQLiteRunResult,
} from 'expo-sqlite';

/** Executa SQL sem resultado (INSERT/UPDATE/DELETE). */
export async function run(
  db: SQLiteDatabase,
  sql: string,
  params: SQLiteBindParams = [],
): Promise<SQLiteRunResult> {
  return db.runAsync(sql, params);
}

/** Lista de linhas. */
export async function queryAll<T>(
  db: SQLiteDatabase,
  sql: string,
  params: SQLiteBindParams = [],
): Promise<T[]> {
  return db.getAllAsync<T>(sql, params);
}

/** Primeira linha ou null. */
export async function queryFirst<T>(
  db: SQLiteDatabase,
  sql: string,
  params: SQLiteBindParams = [],
): Promise<T | null> {
  return db.getFirstAsync<T>(sql, params);
}

/** Várias instruções SQL de uma vez (ex.: migrações). */
export async function execScript(
  db: SQLiteDatabase,
  sql: string,
): Promise<void> {
  await db.execAsync(sql);
}
