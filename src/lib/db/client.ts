import * as SQLite from 'expo-sqlite';

import { DATABASE_NAME } from './constants';
import { migrateLegacyPendingCompletionsFromAsyncStorage } from './migrateLegacyAsyncStorage';
import { migrateDatabase } from './migrate';

let dbSingleton: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre a base (singleton), aplica migrações na primeira utilização.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbSingleton) {
    dbSingleton = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrateDatabase(db);
      await migrateLegacyPendingCompletionsFromAsyncStorage(db);
      return db;
    })();
  }
  return dbSingleton;
}

/**
 * Para testes ou reset: fecha e limpa o singleton (próximo `getDatabase` reabre).
 */
export async function closeDatabaseForTesting(): Promise<void> {
  if (dbSingleton) {
    const db = await dbSingleton;
    await db.closeAsync();
    dbSingleton = null;
  }
}
