import React from 'react';

/**
 * Status and Category Badges
 * Tones: 'ok' | 'dup' | 'warn' | 'bad' | 'neutral' | 'accent' | 'value'
 */
const TONES = {
  ok: 'badge-ok',
  dup: 'badge-dup',
  warn: 'badge-warn',
  bad: 'badge-bad',
  neutral: 'badge-neutral',
  accent: 'badge-accent',
  value: 'text-[var(--color-value)] bg-[color-mix(in_srgb,var(--color-value)_12%,transparent)] border-[color-mix(in_srgb,var(--color-value)_30%,transparent)]',
};

export function Badge({ children, tone = 'neutral', icon, className = '', ...props }) {
  const toneClass = TONES[tone] || TONES.neutral;
  return (
    <span className={`badge ${toneClass} ${className}`} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export function StatusDot({ status = 'VALID', className = '' }) {
  const normalized = String(status || '').toUpperCase();
  const toneMap = {
    VALID: 'ok',
    DUPLICATE: 'dup',
    INCOMPLETE: 'warn',
    ERROR: 'bad',
    INVALID: 'bad',
  };
  const tone = toneMap[normalized] || 'ok';

  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{
        background: `var(--${tone})`,
        boxShadow: `0 0 0 3px var(--${tone}-soft)`,
      }}
    />
  );
}

export function StatusBadge({ status = 'VALID', className = '' }) {
  const normalized = String(status || '').toUpperCase();
  const map = {
    VALID: { tone: 'ok', label: 'Valid' },
    DUPLICATE: { tone: 'dup', label: 'Duplicate' },
    INCOMPLETE: { tone: 'warn', label: 'Incomplete' },
    ERROR: { tone: 'bad', label: 'Error' },
    INVALID: { tone: 'bad', label: 'Invalid' },
  };
  const current = map[normalized] || { tone: 'ok', label: status };

  return (
    <span className={`badge badge-${current.tone} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--${current.tone})` }} />
      {current.label}
    </span>
  );
}

export function NeoTag({ children, className = '', ...props }) {
  return (
    <span className={`neo-tag ${className}`} {...props}>
      {children}
    </span>
  );
}
