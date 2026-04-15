/** Corpo persistido em `outbox.payload` para WORK_ORDER_START */
export interface StartMutationPayload {
  dumpsterId?: string;
}

/** Corpo persistido em `outbox.payload` para WORK_ORDER_COMPLETE */
export interface CompleteMutationPayload {
  lat: number;
  lng: number;
  accuracy?: number;
  notes?: string;
  returnLoad?: 'EMPTY' | 'WITH_RESIDUE';
}
