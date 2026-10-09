import { useEffect, useState } from "react";

/**
 * `value` as it was `delay` ms after it last changed. The timer is the external system being
 * synced with; the previous pending update is dropped on change and on unmount. Pass a
 * referentially stable `value` (a primitive or a memoised object), or the debounce never settles.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
