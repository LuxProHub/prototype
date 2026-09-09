import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ToastContext } from '../../lib/toast';

/**
 * Minimal toast layer.
 *
 * The app had no way to confirm that anything succeeded, and reported a failed
 * export through a native `alert()` -- a modal browser dialog in the middle of
 * a data workspace. This gives one place for "that worked" and "that did not",
 * in the app's own visual language.
 *
 * Deliberately small: no queueing library, no positioning engine, no portals.
 * Toasts are announced politely so a screen reader hears the outcome without
 * losing the user's place.
 */
let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback((message, { tone = 'ok', duration = 4500 } = {}) => {
    const id = ++nextId;
    setToasts((t) => [...t, { id, message, tone, duration }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-80 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ message, tone, duration, onDismiss }) {
  useEffect(() => {
    if (!duration) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const bad = tone === 'bad';
  return (
    <div
      className="glass-raised pointer-events-auto flex items-start gap-2.5 px-3 py-2.5 animate-rise-in"
      role={bad ? 'alert' : 'status'}
    >
      {bad ? (
        <AlertCircle className="w-4 h-4 shrink-0 mt-px text-[var(--bad)]" />
      ) : (
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-px text-[var(--ok)]" />
      )}
      <span className="text-[13px] text-[var(--text)] flex-1 min-w-0">{message}</span>
      <button
        onClick={onDismiss}
        className="btn-ghost w-5 h-5 rounded-[var(--r-sm)] shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
