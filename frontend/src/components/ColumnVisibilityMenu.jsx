import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';

/**
 * ColumnVisibilityMenu Component
 * Dropdown popover allowing operators to toggle table column visibility.
 */
export default function ColumnVisibilityMenu({
  columns = [],
  visibleColumns = {},
  onToggleColumn,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="btn h-8 sm:h-9 px-2.5 text-[12.5px] flex items-center gap-1.5"
        title="Toggle visible columns"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        <span className="hidden sm:inline">Columns</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Column visibility options"
          className="absolute right-0 top-full mt-1.5 z-40 w-52 glass-raised rounded-[var(--radius-md)] p-2 shadow-xl border border-[var(--color-border-strong)] animate-rise-in"
        >
          <div className="text-[11px] font-semibold text-[var(--color-text-muted)] px-2 py-1 uppercase tracking-wider border-b border-[var(--color-border)] mb-1">
            Toggle Columns
          </div>

          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {columns.map((col) => {
              const isVisible = visibleColumns[col.key] !== false;
              return (
                <button
                  key={col.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  onClick={() => onToggleColumn?.(col.key)}
                  className="w-full px-2 py-1.5 rounded-[var(--radius-sm)] flex items-center justify-between text-[12px] hover:bg-[var(--color-surface-elevated)] cursor-pointer text-left transition-colors"
                >
                  <span className={isVisible ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}>
                    {col.label}
                  </span>
                  <span
                    className={`w-4 h-4 rounded-[var(--radius-sm)] flex items-center justify-center border ${
                      isVisible
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    {isVisible && <Check className="w-3 h-3" strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
