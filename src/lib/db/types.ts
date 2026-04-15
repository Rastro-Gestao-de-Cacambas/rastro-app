/**
 * Estado de um item na fila de sincronização.
 * - pending: a enviar
 * - syncing: envio em curso (opcional, para UI)
 * - failed: erro persistente após tentativas
 * - done: enviado com sucesso (pode ser apagado por limpeza)
 */
export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'done';

/** Tipos de mutação (expandir com offline-first) */
export type OutboxMutationType = 'WORK_ORDER_START' | 'WORK_ORDER_COMPLETE';

/** Linha da tabela `outbox` */
export interface OutboxRow {
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

/** Linha da tabela `work_orders` (snapshot JSON da API) */
export interface WorkOrderRow {
  id: string;
  data: string;
  fetched_at: number;
  updated_at: number;
}
