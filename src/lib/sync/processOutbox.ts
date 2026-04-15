import { workOrdersApi } from '@/lib/api';
import {
  bumpOutboxAttempt,
  deleteOutboxRow,
  getNextPendingOutbox,
  markOutboxFailed,
  markOutboxSyncing,
  resetStaleSyncing,
} from '@/lib/db/outboxRepository';
import { upsertWorkOrder } from '@/lib/db/workOrdersRepository';
import type { WorkOrder } from '@/shared';

import type { CompleteMutationPayload, StartMutationPayload } from './payloads';
import { pullDriverWorkOrders } from './pullDriverWorkOrders';

let chain: Promise<void> = Promise.resolve();

function httpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const r = (err as { response?: { status?: number } }).response;
  return r?.status;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function processOutboxLoop(): Promise<void> {
  await resetStaleSyncing();

  while (true) {
    const row = await getNextPendingOutbox();
    if (!row) break;

    await markOutboxSyncing(row.id);

    try {
      if (row.type === 'WORK_ORDER_START') {
        const p = JSON.parse(row.payload) as StartMutationPayload;
        const res = await workOrdersApi.start(
          row.work_order_id,
          p.dumpsterId ? { dumpsterId: p.dumpsterId } : undefined,
        );
        await upsertWorkOrder(res.data as WorkOrder);
      } else {
        const p = JSON.parse(row.payload) as CompleteMutationPayload;
        const res = await workOrdersApi.complete(row.work_order_id, {
          lat: p.lat,
          lng: p.lng,
          ...(p.accuracy != null ? { accuracy: p.accuracy } : {}),
          ...(p.notes?.trim() ? { notes: p.notes.trim() } : {}),
          ...(p.returnLoad ? { returnLoad: p.returnLoad } : {}),
        });
        await upsertWorkOrder(res.data as WorkOrder);
      }
      await deleteOutboxRow(row.id);
    } catch (e) {
      const status = httpStatus(e);
      const msg = errorMessage(e);
      if (
        status === 400 ||
        status === 404 ||
        status === 403
      ) {
        await markOutboxFailed(row.id, msg);
        try {
          await pullDriverWorkOrders();
        } catch {
          /* reconciliação opcional */
        }
      } else {
        await bumpOutboxAttempt(row.id, msg);
      }
      break;
    }
  }
}

/**
 * Processa a fila `outbox` em série (FIFO). Chamadas concurrentes encadeiam-se.
 */
export async function processOutbox(): Promise<void> {
  chain = chain.then(() => processOutboxLoop());
  return chain;
}
