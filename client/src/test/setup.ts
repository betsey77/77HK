import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// Ensure localStorage is available in jsdom environment.
const lsStore = new Map<string, string>();

if (typeof globalThis.localStorage === 'undefined' || process.env.VITEST) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem(key: string) {
        return lsStore.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        lsStore.set(key, value);
      },
      removeItem(key: string) {
        lsStore.delete(key);
      },
      clear() {
        lsStore.clear();
      },
      get length() {
        return lsStore.size;
      },
      key(index: number) {
        return Array.from(lsStore.keys())[index] ?? null;
      },
    },
    writable: true,
    configurable: true,
  });
}

// Ensure sessionStorage is available in jsdom environment (Slice H1-R).
const ssStore = new Map<string, string>();

if (typeof globalThis.sessionStorage === 'undefined' || process.env.VITEST) {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem(key: string) {
        return ssStore.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        ssStore.set(key, value);
      },
      removeItem(key: string) {
        ssStore.delete(key);
      },
      clear() {
        ssStore.clear();
      },
      get length() {
        return ssStore.size;
      },
      key(index: number) {
        return Array.from(ssStore.keys())[index] ?? null;
      },
    },
    writable: true,
    configurable: true,
  });
}

// Clear both stores before each test to prevent sessionStorage leakage
beforeEach(() => {
  lsStore.clear();
  ssStore.clear();
});

// Mock VITE_ env vars for supabase client
if (typeof process !== 'undefined') {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
}

