import type { Database } from "@base-template/db";

/**
 * Deterministic concurrency seam: a database whose `update`/`delete` statements run `beforeWrite`
 * right before they hit the server. A service that pre-reads a row and then writes it will see
 * the row vanish (or change) in between, exactly like a concurrent request winning the race.
 * `beforeWrite` must use the real (unwrapped) database.
 */
export function racingDb(
  db: Database,
  beforeWrite: () => Promise<void>,
  /** `write`: before each update/delete statement; `transaction`: before a transaction opens. */
  seam: "write" | "transaction" = "write",
): Database {
  const wrap = (target: object): object =>
    new Proxy(target, {
      get(inner, prop) {
        const value = Reflect.get(inner, prop, inner) as unknown;
        if (prop === "then" && typeof value === "function") {
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            beforeWrite().then(() => (value as Function).call(inner, resolve, reject), reject);
        }
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const result = (value as Function).apply(inner, args) as unknown;
          return result && typeof result === "object" ? wrap(result) : result;
        };
      },
    });

  return new Proxy(db, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (
        seam === "write" &&
        (prop === "update" || prop === "delete") &&
        typeof value === "function"
      ) {
        return (...args: unknown[]) => wrap((value as Function).apply(target, args) as object);
      }
      if (prop === "transaction" && typeof value === "function") {
        return async (callback: (tx: Database) => unknown, ...rest: unknown[]) => {
          if (seam === "transaction") await beforeWrite();
          // In `write` mode the transaction handle is raced too, so writes inside it hit the seam.
          return (value as Function).call(
            target,
            (tx: Database) => callback(seam === "write" ? racingDb(tx, beforeWrite) : tx),
            ...rest,
          );
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
