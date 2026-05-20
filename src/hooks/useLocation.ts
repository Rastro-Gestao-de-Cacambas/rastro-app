import { useState } from 'react';
import * as Location from 'expo-location';

export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export function useLocation() {
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permissão de localização negada');
        return false;
      }
      return true;
    } catch {
      setError('Erro ao solicitar permissão de localização');
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<CapturedLocation | null> => {
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setLoading(false);
        return null;
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
      setLoading(false);
      return captured;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao obter localização');
      setLoading(false);
      return null;
    }
  };

  return {
    location,
    loading,
    error,
    getCurrentLocation,
  };
}
