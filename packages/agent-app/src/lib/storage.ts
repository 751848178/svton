export interface AgentAppStorage {
  key(name: string): string;
  getString(name: string): string;
  setString(name: string, value: string): void;
  remove(name: string): void;
  getJson<T>(name: string, fallback: T): T;
  setJson(name: string, value: unknown): void;
}

export const DEFAULT_STORAGE_NAMESPACE = 'svton-app';

export function createAgentAppStorage(namespace = DEFAULT_STORAGE_NAMESPACE): AgentAppStorage {
  const normalized = namespace.trim() || DEFAULT_STORAGE_NAMESPACE;
  const key = (name: string) => `${normalized}:${name}`;

  return {
    key,
    getString(name) {
      if (typeof localStorage === 'undefined') return '';
      try {
        return localStorage.getItem(key(name)) || '';
      } catch {
        return '';
      }
    },
    setString(name, value) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key(name), value);
      } catch {
        // Ignore quota and privacy-mode storage errors.
      }
    },
    remove(name) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(key(name));
      } catch {
        // Ignore unavailable storage.
      }
    },
    getJson<T>(name: string, fallback: T): T {
      if (typeof localStorage === 'undefined') return fallback;
      try {
        const raw = localStorage.getItem(key(name));
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    setJson(name, value) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key(name), JSON.stringify(value));
      } catch {
        // Ignore quota and privacy-mode storage errors.
      }
    },
  };
}
