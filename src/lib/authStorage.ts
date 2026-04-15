import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/shared';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REMEMBER_ME_KEY = 'auth_remember_me';
const SAVED_CPF_KEY = 'auth_saved_cpf';
/** Senha lembrada no login (somente com “Lembrar senha”) — SecureStore */
const SAVED_PASSWORD_KEY = 'auth_saved_password';

let inMemoryToken: string | null = null;

function base64Decode(str: string): string {
  if (typeof atob === 'function') return atob(str);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = str.replace(/=+$/, '');
  for (let i = 0; i < str.length; i += 4) {
    const a = chars.indexOf(str[i]);
    const b = chars.indexOf(str[i + 1]);
    const c = chars.indexOf(str[i + 2]);
    const d = chars.indexOf(str[i + 3]);
    output += String.fromCharCode((a << 2) | (b >> 4));
    if (c !== 64) output += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d !== 64) output += String.fromCharCode(((c & 3) << 6) | d);
  }
  try {
    return typeof decodeURIComponent === 'function' && typeof escape === 'function'
      ? decodeURIComponent(escape(output))
      : output;
  } catch {
    return output;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(base64Decode(base64));
    const exp = payload.exp as number | undefined;
    if (typeof exp !== 'number') return false;
    return Date.now() / 1000 >= exp;
  } catch {
    return false;
  }
}

export const authStorage = {
  async setCredentials(token: string, user: User, rememberMe: boolean) {
    if (rememberMe) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
      inMemoryToken = null;
    } else {
      await this.clearPersisted();
      inMemoryToken = token;
    }
  },

  /**
   * Persiste CPF (apenas dígitos) e senha para pré-preencher o próximo acesso.
   * Chamado após login com “Lembrar senha”.
   */
  async saveLoginCredentials(cpf: string, password: string): Promise<void> {
    const digits = cpf.replace(/\D/g, '');
    await AsyncStorage.setItem(SAVED_CPF_KEY, digits);
    await SecureStore.setItemAsync(SAVED_PASSWORD_KEY, password);
  },

  async getSavedCpf(): Promise<string | null> {
    return AsyncStorage.getItem(SAVED_CPF_KEY);
  },

  async getSavedPassword(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SAVED_PASSWORD_KEY);
    } catch {
      return null;
    }
  },

  async getToken(): Promise<string | null> {
    let token: string | null = null;
    if (inMemoryToken) {
      token = inMemoryToken;
    } else {
      try {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) {
          token = await AsyncStorage.getItem('token');
          if (token) {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
            await AsyncStorage.removeItem('token');
          }
        }
      } catch {
        return null;
      }
    }
    if (token && isTokenExpired(token)) {
      await this.clearSession();
      return null;
    }
    return token;
  },

  async getUser(): Promise<User | null> {
    try {
      let userStr = await AsyncStorage.getItem(USER_KEY) ?? await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        await AsyncStorage.setItem(USER_KEY, userStr);
        await AsyncStorage.removeItem('user');
        return user;
      }
      return null;
    } catch {
      return null;
    }
  },

  async getRememberMe(): Promise<boolean> {
    const value = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    return value === 'true';
  },

  /**
   * Encerra a sessão (logout). Mantém CPF/senha salvos se o usuário marcou “Lembrar senha”.
   */
  async clear(): Promise<void> {
    inMemoryToken = null;
    await this.clearSession();
  },

  async clearSession(): Promise<void> {
    inMemoryToken = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
    await AsyncStorage.multiRemove([USER_KEY, REMEMBER_ME_KEY, 'token', 'user']);
  },

  /** Remove token/sessão e credenciais lembradas (ex.: login sem “Lembrar senha”). */
  async clearPersisted(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
    try {
      await SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
    } catch {}
    await AsyncStorage.multiRemove([USER_KEY, REMEMBER_ME_KEY, SAVED_CPF_KEY, 'token', 'user']);
  },
};
