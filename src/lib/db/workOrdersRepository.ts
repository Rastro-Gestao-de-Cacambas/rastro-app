import type { WorkOrder } from '@/shared';

import { getDatabase } from './client';
import { queryAll, queryFirst, run } from './wrapper';

function sortBySequence(a: WorkOrder, b: WorkOrder): number {
  return (a.sequence ?? 0) - (b.sequence ?? 0);
}

/** Lista todas as ordens no snapshot local (ordenadas por sequência). */
export async function getAllWorkOrders(): Promise<WorkOrder[]> {
  const db = await getDatabase();
  const rows = await queryAll<{ data: string }>(
    db,
    'SELECT data FROM work_orders',
    [],
  );
  const orders = rows.map((r) => JSON.parse(r.data) as WorkOrder);
  return orders.sort(sortBySequence);
}

/** Uma ordem por id ou null. */
export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  const db = await getDatabase();
  const row = await queryFirst<{ data: string }>(
    db,
    'SELECT data FROM work_orders WHERE id = ?',
    [id],
  );
  if (!row) return null;
  return JSON.parse(row.data) as WorkOrder;
}

/**
 * Substitui o snapshot pelo resultado do GET /work-orders/driver
 * (fonte de verdade após pull).
 */
export async function replaceAllWorkOrders(orders: WorkOrder[]): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await run(db, 'DELETE FROM work_orders', []);
    for (const o of orders) {
      await run(
        db,
        'INSERT INTO work_orders (id, data, fetched_at, updated_at) VALUES (?, ?, ?, ?)',
        [o.id, JSON.stringify(o), now, now],
      );
    }
  });
}

/** Insere ou atualiza uma ordem (ex.: após start/complete). */
export async function upsertWorkOrder(order: WorkOrder): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await run(
    db,
    `INSERT INTO work_orders (id, data, fetched_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data,
       fetched_at = excluded.fetched_at,
       updated_at = excluded.updated_at`,
    [order.id, JSON.stringify(order), now, now],
  );
}
