import { useState } from 'react';
import * as Location from 'expo-location';

export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

/**
 * `blocked` = permissão negada com "não perguntar de novo". A partir daí o Android
 * não exibe mais o diálogo, então pedir de novo não adianta: a única saída é o
 * motorista liberar o acesso nas configurações do sistema.
 */
export type LocationResult =
  | { status: 'granted'; location: CapturedLocation }
  | { status: 'denied' }
  | { status: 'blocked' }
  | { status: 'error'; message: string };

export function useLocation() {
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = async (): Promise<LocationResult> => {
    setLoading(true);
    setError(null);

    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permissão de localização negada');
        return canAskAgain ? { status: 'denied' } : { status: 'blocked' };
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const captured: CapturedLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy || undefined,
      };

      setLocation(captured);
      return { status: 'granted', location: captured };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao obter localização';
      setError(message);
      return { status: 'error', message };
    } finally {
      setLoading(false);
    }
  };

  return {
    location,
    loading,
    error,
    getCurrentLocation,
  };
}
