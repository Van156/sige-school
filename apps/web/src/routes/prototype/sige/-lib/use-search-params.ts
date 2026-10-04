import { useRouterState } from "@tanstack/react-router";

function rawSearch(name: string) {
  return (state: { location: { search: unknown } }): unknown =>
    (state.location.search as Record<string, unknown>)[name];
}

/** `?id=` of edit forms and per-institution screens (the router parses it as number or string). */
export function useIdParam(): number | undefined {
  const value = useRouterState({ select: rawSearch("id") });
  const id = Number(value);
  return value !== undefined && Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Raw `?rol=` filter of the user screens (preselects the role on the create form). */
export function useRolParam(): string | undefined {
  const value = useRouterState({ select: rawSearch("rol") });
  return typeof value === "string" && value ? value : undefined;
}

/** Raw string search param (`?user=`, `?grade=`...) of the T3 screens; `undefined` when absent. */
export function useStringParam(name: string): string | undefined {
  const value = useRouterState({ select: rawSearch(name) });
  if (typeof value === "string") return value || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
}

/** Positive integer search param (`?student=`, `?grade=`); `undefined` when absent or invalid. */
export function useIntParam(name: string): number | undefined {
  const value = useStringParam(name);
  const parsed = Number(value);
  return value !== undefined && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
