import type { Dumpster, WorkOrder } from '@/shared';
import { DumpsterStatus, WorkOrderStatus } from '@/shared';

import type { CompleteMutationPayload } from './payloads';

const DEFAULT_REMINDER_DAYS = 7;

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Patch otimista após “Dar partida” (alinhado ao servidor: IN_PROGRESS + startedAt).
 */
export function applyOptimisticStart(
  wo: WorkOrder,
  opts: { dumpsterId?: string; dumpster?: Dumpster | null },
): WorkOrder {
  const startedAt = new Date();
  const next: WorkOrder = {
    ...wo,
    status: WorkOrderStatus.IN_PROGRESS,
    startedAt,
  };
  if (opts.dumpsterId) {
    next.dumpsterId = opts.dumpsterId;
    if (opts.dumpster) {
      next.dumpster = opts.dumpster;
    }
  }
  return next;
}

/**
 * Patch otimista após “Concluir” (troca etapa 1, etapa 2, retirada, entrega final, etc.).
 */
export function applyOptimisticComplete(
  wo: WorkOrder,
  body: CompleteMutationPayload,
): WorkOrder {
  if (wo.type === 'EXCHANGE' && (wo.exchangeLeg ?? 1) === 1) {
    const jobSiteId = wo.jobSiteId ?? null;
    const returnDueDate = wo.returnDueDate
      ? new Date(wo.returnDueDate)
      : addDays(new Date(), DEFAULT_REMINDER_DAYS);

    let exchangeDumpster = wo.exchangeDumpster;
    if (exchangeDumpster && wo.exchangeDumpsterId) {
      exchangeDumpster = {
        ...exchangeDumpster,
        status: DumpsterStatus.IN_USE,
        currentJobSiteId: jobSiteId ?? undefined,
        lastLat: body.lat,
        lastLng: body.lng,
        lastAccuracy: body.accuracy,
        lastLocationAt: new Date(),
      };
    }

    return {
      ...wo,
      status: WorkOrderStatus.IN_PROGRESS,
      exchangeLeg: 2,
      returnDueDate,
      exchangeDumpster: exchangeDumpster ?? wo.exchangeDumpster,
    };
  }

  const completedAt = new Date();

  if (wo.type === 'EXCHANGE') {
    return {
      ...wo,
      status: WorkOrderStatus.DONE,
      completedAt,
      exchangeLeg: null,
    };
  }

  return {
    ...wo,
    status: WorkOrderStatus.DONE,
    completedAt,
  };
}
