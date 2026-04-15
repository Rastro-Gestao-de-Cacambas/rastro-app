import { workOrdersApi } from '@/lib/api';
import { getDatabase, setMeta } from '@/lib/db';
import { replaceAllWorkOrders } from '@/lib/db/workOrdersRepository';
import type { WorkOrder } from '@/shared';

const META_LAST_PULL = 'last_work_orders_pull_at';

/**
 * Obtém ordens do servidor e grava o snapshot local (`work_orders`).
 */
export async function pullDriverWorkOrders(): Promise<void> {
  const response = await workOrdersApi.getMyOrders();
  const list = response.data as WorkOrder[];
  await replaceAllWorkOrders(list);
  const db = await getDatabase();
  await setMeta(db, META_LAST_PULL, new Date().toISOString());
}
