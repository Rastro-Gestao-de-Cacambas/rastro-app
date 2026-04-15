import { authStorage } from '@/lib/authStorage';

import { processOutbox } from './processOutbox';
import { pullDriverWorkOrders } from './pullDriverWorkOrders';

let engineChain: Promise<void> = Promise.resolve();

/**
 * Motor de sincronização: **1)** esvazia a outbox (FIFO via `processOutbox`);
 * **2)** pull das ordens do motorista.
 * Pedidos encadeados para não sobrepor envios.
 */
export async function runSyncEngine(): Promise<void> {
  const token = await authStorage.getToken();
  if (!token) {
    return;
  }

  engineChain = engineChain.then(async () => {
    try {
      await processOutbox();
    } catch (e) {
      console.error('[SyncEngine] flush outbox:', e);
    }
    try {
      await pullDriverWorkOrders();
    } catch (e) {
      console.error('[SyncEngine] pull:', e);
    }
  });

  return engineChain;
}
