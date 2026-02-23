import { useRef, useCallback } from 'react';

/**
 * Returns a debounced version of the callback.
 * The callback will only fire after `delay` ms of inactivity.
 */
export function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number = 500
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  ) as T;
}
