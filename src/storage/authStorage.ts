import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type StoredAuthPayload = {
  token: string;
  refreshToken: string;
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
    is_admin: boolean;
  };
};

const STORAGE_KEY = 'splitpal.auth';

let secureStoreAvailablePromise: Promise<boolean> | null = null;
let inMemoryAvailable = false;

type WebLocalStorage = {
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
};

const getWebLocalStorage = (): WebLocalStorage | null => {
  const scope =
    Platform.OS === 'web' && typeof globalThis !== 'undefined'
      ? (globalThis as {localStorage?: WebLocalStorage})
      : null;
  return scope?.localStorage ?? null;
};

const isSecureStoreAvailable = async (): Promise<boolean> => {
  if (!secureStoreAvailablePromise) {
    secureStoreAvailablePromise = SecureStore.isAvailableAsync()
      .then(value => {
        inMemoryAvailable = Boolean(value);
        return inMemoryAvailable;
      })
      .catch(() => {
        inMemoryAvailable = false;
        return false;
      });
  }
  if (inMemoryAvailable) {
    return true;
  }
  const resolved = await secureStoreAvailablePromise;
  inMemoryAvailable = resolved;
  return resolved;
};

const serialize = (payload: StoredAuthPayload) => JSON.stringify(payload);

const deserialize = (raw: string | null): StoredAuthPayload | null => {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredAuthPayload;
  } catch (error) {
    return null;
  }
};

export const saveAuthPayload = async (payload: StoredAuthPayload): Promise<void> => {
  const data = serialize(payload);
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(STORAGE_KEY, data);
    return;
  }

  const localStorage = getWebLocalStorage();
  if (localStorage) {
    localStorage.setItem(STORAGE_KEY, data);
  }
};

export const loadAuthPayload = async (): Promise<StoredAuthPayload | null> => {
  if (await isSecureStoreAvailable()) {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return deserialize(raw);
  }

  const localStorage = getWebLocalStorage();
  if (localStorage) {
    return deserialize(localStorage.getItem(STORAGE_KEY));
  }

  return null;
};

export const clearAuthPayload = async (): Promise<void> => {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return;
  }

  const localStorage = getWebLocalStorage();
  if (localStorage) {
    localStorage.removeItem(STORAGE_KEY);
  }
};
