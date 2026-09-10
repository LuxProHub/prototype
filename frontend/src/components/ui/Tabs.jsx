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
      className={`inline-flex items-center rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--edge)] ${sizeClasses} ${className}`}
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
            className={`relative flex items-center justify-center gap-1.5 px-3 h-full rounded-[var(--r-sm)] font-medium transition-all select-none cursor-pointer ${
              isActive
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm font-semibold border border-[var(--edge)]'
                : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]'
            }`}
          >
            <span>{label}</span>
            {count !== null && count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full num ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                    : 'bg-[var(--surface-2)] text-[var(--text-3)]'
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
