import { colors } from '@/theme';
import { WorkOrderStatus, WorkOrderType } from '@/shared';

export function getWorkOrderScheduledDateLabel(type: WorkOrderType): string {
  const labels: Record<WorkOrderType, string> = {
    [WorkOrderType.DROP_OFF]: 'Data da entrega',
    [WorkOrderType.PICK_UP]: 'Data da retirada',
    [WorkOrderType.EXCHANGE]: 'Data da troca',
    [WorkOrderType.DUMP]: 'Data prevista',
  };
  return labels[type] ?? 'Data prevista';
}

export function getStatusColor(status: WorkOrderStatus): string {
  const map: Record<string, string> = {
    PENDING:     colors.statusPending,
    IN_PROGRESS: colors.statusInProgress,
    DELIVERED:   colors.statusDelivered,
    DONE:        colors.statusDone,
    CANCELED:    colors.statusCanceled,
  };
  return map[status] ?? colors.statusDefault;
}

export function getStatusLabel(status: WorkOrderStatus): string {
  const map: Record<string, string> = {
    PENDING:     'Pendente',
    IN_PROGRESS: 'Em Andamento',
    DELIVERED:   'Entregue',
    DONE:        'Concluída',
    CANCELED:    'Cancelada',
  };
  return map[status] ?? status;
}

export function getTypeLabel(type: WorkOrderType): string {
  const map: Record<string, string> = {
    DROP_OFF: 'Entrega',
    PICK_UP:  'Retirada',
    EXCHANGE: 'Troca',
    DUMP:     'Descarte',
  };
  return map[type] ?? type;
}
