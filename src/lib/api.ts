import { authStorage } from '@/lib/authStorage';
import { AuthResponseDto, Dumpster, LoginDto, WorkOrder } from '@/shared';
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
  // Backend always returns { data, total } — even without page param
  getAll: () => api.get<{ data: Dumpster[]; total: number }>('/dumpsters'),
  getAvailable: () =>
    api.get<{ data: Dumpster[]; total: number }>('/dumpsters', {
      params: { status: 'AVAILABLE' },
    }),
  getById: (id: string) => api.get<Dumpster>(`/dumpsters/${id}`),
};

export const workOrdersApi = {
  getMyOrders: () => api.get<WorkOrder[]>('/work-orders/driver'),
  getById: (id: string) => api.get<WorkOrder>(`/work-orders/driver/${id}`),
  start: (id: string, body?: { dumpsterId?: string }) =>
    api.post<WorkOrder>(`/work-orders/driver/${id}/start`, body ?? {}),
  complete: (
    id: string,
    body: {
      lat: number;
      lng: number;
      accuracy?: number;
      notes?: string;
    },
  ) => api.post<WorkOrder>(`/work-orders/driver/${id}/complete`, body),
};

export default api;
