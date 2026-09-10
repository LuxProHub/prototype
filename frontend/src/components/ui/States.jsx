import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Loading, empty, error and skeleton states.
 */
function Shell({ icon, tone = 'neutral', title, body, action, dense }) {
  const ring =
    tone === 'bad'
      ? 'bg-[var(--bad-soft)] border-[var(--bad)]/30'
      : 'bg-[var(--surface-2)] border-[var(--edge)]';
  return (
    <div
      role="status"
      className={`flex flex-col items-center text-center gap-2.5 ${dense ? 'py-6' : 'py-14'}`}

    >
      {icon && (
        <span className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-xs ${ring}`}>
          {icon}
        </span>
      )}
      <div className="text-[13.5px] font-semibold text-[var(--text)]">{title}</div>
      {body && <div className="text-[12px] text-[var(--text-3)] max-w-sm leading-relaxed">{body}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, dense }) {
  return <Shell icon={icon} title={title} body={body} action={action} dense={dense} />;
}

export function ErrorState({ title = 'Could not load this view', error, onRetry, dense }) {
  // An authorization refusal is permanent. Offering "retry" on it is a lie.
  const permanent = /authori[sz]|permission|forbidden|not allowed/i.test(String(error || ''));
  return (
    <Shell
      tone="bad"
      dense={dense}
      icon={<AlertCircle className="w-5 h-5 text-[var(--bad)]" />}
      title={title}
      body={
        <>
          {typeof error === 'string' ? error : 'The server did not respond.'}
          {!permanent && ' Nothing was changed — retry once the connection is back.'}
        </>
      }
      action={
        onRetry && !permanent && (
          <button onClick={onRetry} className="btn h-8 px-3 text-[12px] mt-1 gap-1.5 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry request</span>
          </button>
        )
      }
    />
  );
}

/**
 * Skeleton rows for tabular data.
 */
export function LoadingRows({ rows = 6, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-[var(--r-md)] bg-[var(--surface-2)] animate-pulse"
          style={{ opacity: Math.max(0.2, 1 - i * 0.12) }}
        />
      ))}
    </div>
  );
}

/**
 * Granular Skeleton primitive.
 */
export function Skeleton({ className = '', variant = 'rectangular', ...props }) {
  const variantClass = variant === 'circular' ? 'rounded-full' : 'rounded-[var(--r-md)]';
  return (
    <div
      className={`bg-[var(--surface-2)] animate-pulse ${variantClass} ${className}`}
      {...props}
    />
  );
}
