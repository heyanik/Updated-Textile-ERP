import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Optimistically append an item to a list-shaped query cache.
 * Returns a rollback context for onError. Pair with onSettled → invalidateQueries. */
export async function optimisticAppend<T>(qc: QueryClient, key: QueryKey, item: T) {
  await qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<T[]>(key);
  qc.setQueryData<T[]>(key, (old) => [...(old ?? []), item]);
  return { prev };
}

export async function optimisticUpdate<T extends Record<string, any>>(
  qc: QueryClient, key: QueryKey, idField: keyof T, idValue: any, patch: Partial<T>,
) {
  await qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<T[]>(key);
  qc.setQueryData<T[]>(key, (old) =>
    (old ?? []).map((r) => (r[idField] === idValue ? { ...r, ...patch } : r)),
  );
  return { prev };
}

export async function optimisticRemove<T extends Record<string, any>>(
  qc: QueryClient, key: QueryKey, idField: keyof T, idValue: any,
) {
  await qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<T[]>(key);
  qc.setQueryData<T[]>(key, (old) => (old ?? []).filter((r) => r[idField] !== idValue));
  return { prev };
}

export function tempId(prefix = "TMP") { return `${prefix}-${Date.now()}`; }