import { WorkOrderType } from '@/shared';

export function getWorkOrderScheduledDateLabel(type: WorkOrderType): string {
  const labels: Record<WorkOrderType, string> = {
    [WorkOrderType.DROP_OFF]: 'Data da entrega',
    [WorkOrderType.PICK_UP]: 'Data da retirada',
    [WorkOrderType.EXCHANGE]: 'Data da troca',
    [WorkOrderType.DUMP]: 'Data prevista',
  };
  return labels[type] ?? 'Data prevista';
}
