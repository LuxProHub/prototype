import React from 'react';

/**
 * Segmented Control / Tabs Primitive
 * Provides tactile, soft 3D tab selection with keyboard accessibility.
 */
export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  size = 'md',
  className = '',
}) {
  const sizeClasses = {
    sm: 'h-7 p-0.5 text-[11px]',
    md: 'h-8 sm:h-9 p-1 text-[12.5px]',
    lg: 'h-10 p-1 text-[13.5px]',
  }[size] || 'h-8 sm:h-9 p-1 text-[12.5px]';

  return (
    <div
      role="tablist"
      className={`inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] ${sizeClasses} ${className}`}
    >
      {tabs.map((tab) => {
        const id = typeof tab === 'object' ? tab.id : tab;
        const label = typeof tab === 'object' ? tab.label : tab;
        const count = typeof tab === 'object' ? tab.count : null;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`relative flex items-center justify-center gap-1.5 px-3 h-full rounded-[var(--radius-sm)] font-medium transition-all select-none cursor-pointer ${
              isActive
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm font-semibold border border-[var(--color-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]'
            }`}
          >
            <span>{label}</span>
            {count !== null && count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full num ${
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                    : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
