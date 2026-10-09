import type { QueryClient } from "@tanstack/react-query";

/** `me.get` rejection for an account without a person row in the institution (platform admins). */
const NO_PERSON_CODE = "NO_PERSON";

export function isNoPersonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === NO_PERSON_CODE
  );
}

const SIGE_ME_ROOT_KEY = ["sige-me"] as const;

/** Per-user key: a second sign-in in the same tab never reads the previous user's `me.get`. */
export function sigeMeQueryKey(userId: string | undefined) {
  return [...SIGE_ME_ROOT_KEY, userId] as const;
}

/**
 * Query options of the signed-in user's `me.get`, shared by the password gate and `useSigeMe` so
 * both read one cache entry. An account without a person (`NO_PERSON`) resolves to `null`.
 */
export function sigeMeQueryOptions<TMe>(userId: string | undefined, fetchMe: () => Promise<TMe>) {
  return {
    queryKey: sigeMeQueryKey(userId),
    queryFn: async (): Promise<TMe | null> => {
      try {
        return await fetchMe();
      } catch (error) {
        if (isNoPersonError(error)) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  };
}

/** Drops every user's cached `me.get`; call on sign-in, sign-out and after the forced change. */
export function clearSigeMeCache(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: SIGE_ME_ROOT_KEY });
}
