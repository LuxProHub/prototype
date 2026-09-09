import { createContext, useContext } from 'react';

/**
 * Toast context lives apart from the provider component so the module that
 * exports `useToast` exports no components. That keeps React Fast Refresh able
 * to hot-swap the provider without dropping every toast on screen.
 */
export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  // A no-op fallback keeps a component usable outside the provider (tests,
  // isolated rendering) instead of crashing on a missing context.
  return ctx || { notify: () => {}, dismiss: () => {} };
}
