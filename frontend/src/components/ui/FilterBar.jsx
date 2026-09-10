import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

/**
 * FilterBar & FilterChip Primitives
 * High-density 2D filter controls combined with clean filter chips.
 */
export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  activeChips = [],
  onClearAll,
  children,
  className = '',
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="field w-full h-8 sm:h-9 pl-9 pr-3 text-[13px]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          {children}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-[var(--text-3)] font-medium mr-1">
            Active filters:
          </span>
          {activeChips.map((chip, idx) => (
            <FilterChip
              key={chip.id || idx}
              label={chip.label}
              onRemove={chip.onRemove}
            />
          ))}
          {onClearAll && (
            <button
              onClick={onClearAll}
              className="btn-ghost h-6 px-2 text-[11px] text-[var(--text-3)] hover:text-[var(--bad)] flex items-center gap-1 ml-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterChip({ label, onRemove }) {
  return (
    <span className="chip text-[11.5px] font-medium">
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove filter ${label}`}
          className="hover:opacity-75 cursor-pointer ml-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
