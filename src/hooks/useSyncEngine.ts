import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { runSyncEngine } from '@/lib/sync/syncEngine';

/**
 * Dispara `runSyncEngine` quando a rede fica disponível e quando a app volta ao primeiro plano.
 */
export function useSyncEngine(): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true;
      if (wasConnectedRef.current === false && connected) {
        void runSyncEngine();
      }
      wasConnectedRef.current = connected;
    });

    const subApp = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      if (
        /inactive|background/.test(prev) &&
        next === 'active'
      ) {
        void runSyncEngine();
      }
      appStateRef.current = next;
    });

    void NetInfo.fetch().then((state) => {
      const connected = state.isConnected === true;
      wasConnectedRef.current = connected;
      if (connected) {
        void runSyncEngine();
      }
    });

    return () => {
      unsubNet();
      subApp.remove();
    };
  }, []);
}
