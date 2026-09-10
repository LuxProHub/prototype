import React, { useState, useRef, useEffect } from 'react';
import { Columns3, Check } from 'lucide-react';

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
        <Columns3 className="w-3.5 h-3.5 text-[var(--text-3)]" />
        <span>Columns</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Column visibility options"
          className="absolute right-0 top-full mt-1.5 z-40 w-52 glass-raised rounded-[var(--r-md)] p-2 shadow-xl border border-[var(--edge-strong)] animate-rise-in"
        >
          <div className="t-label px-2 py-1 border-b border-[var(--edge)] mb-1">
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
                  className="w-full px-2 py-1.5 rounded-[var(--r-sm)] flex items-center justify-between text-[12px] hover:bg-[var(--surface-2)] cursor-pointer text-left transition-colors"
                >
                  <span className={isVisible ? 'text-[var(--text)] font-medium' : 'text-[var(--text-3)]'}>
                    {col.label}
                  </span>
                  <span
                    className={`w-4 h-4 rounded-[var(--r-sm)] flex items-center justify-center border ${
                      isVisible
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'border-[var(--edge)]'
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
