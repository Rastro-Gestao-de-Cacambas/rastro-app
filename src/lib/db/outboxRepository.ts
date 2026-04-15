import { getDatabase } from './client';
import { queryFirst, run } from './wrapper';

import type { CompleteMutationPayload, StartMutationPayload } from '../sync/payloads';

function newOutboxId(): string {
  return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface OutboxRowDb {
  id: string;
  type: string;
  work_order_id: string;
  payload: string;
  sequence: number;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: number;
}

/** Reverte linhas presas em `syncing` (crash durante envio). */
export async function resetStaleSyncing(): Promise<void> {
  const db = await getDatabase();
  await run(
    db,
    `UPDATE outbox SET status = 'pending' WHERE status = 'syncing'`,
    [],
  );
}

export async function getNextPendingOutbox(): Promise<OutboxRowDb | null> {
  const db = await getDatabase();
  return queryFirst<OutboxRowDb>(
    db,
    `SELECT id, type, work_order_id, payload, sequence, status, attempts, last_error, created_at
     FROM outbox WHERE status = 'pending' ORDER BY sequence ASC LIMIT 1`,
    [],
  );
}

export async function markOutboxSyncing(id: string): Promise<void> {
  const db = await getDatabase();
  await run(db, `UPDATE outbox SET status = 'syncing' WHERE id = ?`, [id]);
}

export async function deleteOutboxRow(id: string): Promise<void> {
  const db = await getDatabase();
  await run(db, `DELETE FROM outbox WHERE id = ?`, [id]);
}

export async function markOutboxFailed(id: string, message: string): Promise<void> {
  const db = await getDatabase();
  await run(
    db,
    `UPDATE outbox SET status = 'failed', last_error = ? WHERE id = ?`,
    [message, id],
  );
}

export async function bumpOutboxAttempt(id: string, message: string): Promise<void> {
  const db = await getDatabase();
  await run(
    db,
    `UPDATE outbox SET status = 'pending', attempts = attempts + 1, last_error = ? WHERE id = ?`,
    [message, id],
  );
}

export async function enqueueWorkOrderStart(
  workOrderId: string,
  payload: StartMutationPayload,
): Promise<string> {
  const db = await getDatabase();
  const id = newOutboxId();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ n: number }>(
      'SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM outbox',
      [],
    );
    const sequence = row?.n ?? 1;
    await txn.runAsync(
      `INSERT INTO outbox (id, type, work_order_id, payload, sequence, status, attempts, last_error, created_at)
       VALUES (?, 'WORK_ORDER_START', ?, ?, ?, 'pending', 0, NULL, ?)`,
      [id, workOrderId, JSON.stringify(payload), sequence, now],
    );
  });
  return id;
}

export async function enqueueWorkOrderComplete(
  workOrderId: string,
  payload: CompleteMutationPayload,
): Promise<string> {
  const db = await getDatabase();
  const id = newOutboxId();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ n: number }>(
      'SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM outbox',
      [],
    );
    const sequence = row?.n ?? 1;
    await txn.runAsync(
      `INSERT INTO outbox (id, type, work_order_id, payload, sequence, status, attempts, last_error, created_at)
       VALUES (?, 'WORK_ORDER_COMPLETE', ?, ?, ?, 'pending', 0, NULL, ?)`,
      [id, workOrderId, JSON.stringify(payload), sequence, now],
    );
  });
  return id;
}
