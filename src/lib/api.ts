import { authStorage } from '@/lib/authStorage';
import { AuthResponseDto, LoginDto } from '@/shared';
import axios from 'axios';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/') ?? false;
      if (!isLoginRequest) {
        await authStorage.clearSession();
        router.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponseDto> => {
    const response = await api.post('/auth/driver/login', {
      cpf: data.cpf.replace(/\D/g, ''),
      password: data.password,
    });
    return response.data;
  },
};

export const dumpstersApi = {
  getAll: () => api.get('/dumpsters'),
  getById: (id: string) => api.get(`/dumpsters/${id}`),
};

export const workOrdersApi = {
  getMyOrders: () => api.get('/work-orders/driver'),
  getById: (id: string) => api.get(`/work-orders/driver/${id}`),
  start: (id: string, body?: { dumpsterId?: string }) =>
    api.post(`/work-orders/driver/${id}/start`, body ?? {}),
  complete: async (
    id: string,
    body: {
      lat: number;
      lng: number;
      accuracy?: number;
      notes?: string;
      returnLoad?: 'EMPTY' | 'WITH_RESIDUE';
    },
  ) => {
    const token = await authStorage.getToken();
    const baseURL = API_URL.replace(/\/$/, '');
    const url = `${baseURL}/work-orders/driver/${id}/complete`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      if (response.status === 401) {
        await authStorage.clearSession();
        router.replace('/login');
      }
      const err = new Error(`Request failed with status ${response.status}`);
      (err as Error & { response?: { status: number; data?: unknown } }).response = {
        status: response.status,
        data: await response.json().catch(() => ({})),
      };
      throw err;
    }
    return { data: await response.json() };
  },
};

export default api;
