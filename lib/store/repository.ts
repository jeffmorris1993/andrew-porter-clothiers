import type { StateStorage } from "zustand/middleware";

/* Persistence boundary. The app reads and writes its session through this
   interface; today it is the browser's localStorage. A Supabase-backed
   repository can implement the same three methods later. */

export type SessionRepository = StateStorage;

export class LocalStorageRepository implements SessionRepository {
  getItem(name: string) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  }
  setItem(name: string, value: string) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* storage full or blocked — the session simply won't persist */
    }
  }
  removeItem(name: string) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryRepository implements SessionRepository {
  private m = new Map<string, string>();
  getItem(name: string) {
    return this.m.get(name) ?? null;
  }
  setItem(name: string, value: string) {
    this.m.set(name, value);
  }
  removeItem(name: string) {
    this.m.delete(name);
  }
}

export function defaultRepository(): SessionRepository {
  return typeof window === "undefined" ? new MemoryRepository() : new LocalStorageRepository();
}
