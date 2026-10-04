import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * Mutation stubs. Screens never persist anything: an action either only shows a toast, or edits an
 * in-memory collection created with `createMockCollection` (state lives until the page reloads).
 */

export function mockAction(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

export function mockInfo(message: string, description?: string) {
  toast.info(message, description ? { description } : undefined);
}

export interface MockCollection<T extends { id: number }> {
  getSnapshot: () => readonly T[];
  subscribe: (listener: () => void) => () => void;
  add: (item: Omit<T, "id">) => T;
  update: (id: number, patch: Partial<T>) => void;
  remove: (id: number) => void;
}

export function createMockCollection<T extends { id: number }>(
  initial: readonly T[],
): MockCollection<T> {
  let items: readonly T[] = initial;
  const listeners = new Set<() => void>();
  const commit = (next: readonly T[]) => {
    items = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => items,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add: (item) => {
      const created = { ...item, id: Math.max(0, ...items.map((entry) => entry.id)) + 1 } as T;
      commit([...items, created]);
      return created;
    },
    update: (id, patch) =>
      commit(items.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))),
    remove: (id) => commit(items.filter((entry) => entry.id !== id)),
  };
}

export function useMockCollection<T extends { id: number }>(
  collection: MockCollection<T>,
): readonly T[] {
  return useSyncExternalStore(collection.subscribe, collection.getSnapshot, collection.getSnapshot);
}

export function mockError(message: string, description?: string) {
  toast.error(message, description ? { description } : undefined);
}
