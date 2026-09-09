import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Loading, empty and error states.
 *
 * These exist as one component because the distinction between them is a
 * product rule, not a styling choice: a request that failed must never render
 * as "there is no data". Several pages used to swallow the failure in a
 * console.error and fall through to their empty state, which sends an operator
 * hunting for a filter when the real problem is that the API is unreachable.
 *
 * Pass `error` and you get the failure state with a retry. Pass nothing and you
 * get the genuine "no data" state.
 */

function Shell({ icon, tone = 'neutral', title, body, action, dense }) {
  const ring =
    tone === 'bad'
      ? 'bg-[var(--bad-soft)] border-[var(--bad)]/30'
      : 'bg-[var(--surface-2)] border-[var(--edge)]';
  return (
    <div
      role="status"
      className={`flex flex-col items-center text-center gap-2 ${dense ? 'py-8' : 'py-16'}`}
    >
      {icon && (
        <span className={`w-10 h-10 rounded-full border flex items-center justify-center ${ring}`}>
          {icon}
        </span>
      )}
      <div className="text-[13px] font-medium text-[var(--text)]">{title}</div>
      {body && <div className="text-[12px] text-[var(--text-3)] max-w-xs">{body}</div>}
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, dense }) {
  return <Shell icon={icon} title={title} body={body} action={action} dense={dense} />;
}

export function ErrorState({ title = 'Could not load this view', error, onRetry, dense }) {
  return (
    <Shell
      tone="bad"
      dense={dense}
      icon={<AlertCircle className="w-4.5 h-4.5 text-[var(--bad)]" />}
      title={title}
      body={
        <>
          {typeof error === 'string' ? error : 'The server did not respond.'}{' '}
          Nothing was changed — retry once the connection is back.
        </>
      }
      action={
        onRetry && (
          <button onClick={onRetry} className="btn h-8 px-3 text-[12px] mt-1">
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        )
      }
    />
  );
}

/**
 * Skeleton rows. Real content is replaced in place rather than swapped for a
 * spinner, so the page does not jump height while data arrives.
 */
export function LoadingRows({ rows = 6, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-[var(--r-md)] bg-[var(--surface-2)] animate-pulse"
          style={{ opacity: 1 - i * 0.1 }}
        />
      ))}
    </div>
  );
}
