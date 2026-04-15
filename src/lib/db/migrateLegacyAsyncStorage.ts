import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CompleteMutationPayload } from '../sync/payloads';
import { getMeta, setMeta } from './meta';

const LEGACY_STORAGE_KEY = '@pending_completions';
const META_LEGACY_MIGRATED = 'legacy_pending_completions_migrated';

/** Formato antigo (`storage.ts` removido) — mantido só para importação. */
interface LegacyPendingCompletion {
  workOrderId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  notes: string;
  timestamp: string;
  returnLoad?: 'EMPTY' | 'WITH_RESIDUE';
}

function toCompletePayload(row: LegacyPendingCompletion): CompleteMutationPayload {
  return {
    lat: row.lat,
    lng: row.lng,
    ...(row.accuracy != null ? { accuracy: row.accuracy } : {}),
    ...(row.notes?.trim() ? { notes: row.notes.trim() } : {}),
    ...(row.returnLoad ? { returnLoad: row.returnLoad } : {}),
  };
}

/**
 * Importa uma vez conclusões pendentes guardadas no AsyncStorage (formato antigo)
 * para a tabela `outbox` como `WORK_ORDER_COMPLETE`.
 * Deve correr com a instância `db` já migrada (schema v1), **sem** chamar `getDatabase()` no interior.
 */
export async function migrateLegacyPendingCompletionsFromAsyncStorage(
  db: SQLiteDatabase,
): Promise<void> {
  if ((await getMeta(db, META_LEGACY_MIGRATED)) === '1') {
    return;
  }

  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw == null || raw === '') {
    await setMeta(db, META_LEGACY_MIGRATED, '1');
    return;
  }

  let items: LegacyPendingCompletion[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      await setMeta(db, META_LEGACY_MIGRATED, '1');
      return;
    }
    items = parsed as LegacyPendingCompletion[];
  } catch {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    await setMeta(db, META_LEGACY_MIGRATED, '1');
    return;
  }

  if (items.length === 0) {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    await setMeta(db, META_LEGACY_MIGRATED, '1');
    return;
  }

  const now = Date.now();

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = await txn.getFirstAsync<{ n: number }>(
        'SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM outbox',
        [],
      );
      const sequence = row?.n ?? 1;
      const id = `ob-legacy-${item.timestamp}-${i}`;
      const payload = JSON.stringify(toCompletePayload(item));
      await txn.runAsync(
        `INSERT INTO outbox (id, type, work_order_id, payload, sequence, status, attempts, last_error, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?)`,
        [
          id,
          'WORK_ORDER_COMPLETE',
          item.workOrderId,
          payload,
          sequence,
          now,
        ],
      );
    }
  });

  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  await setMeta(db, META_LEGACY_MIGRATED, '1');
}
