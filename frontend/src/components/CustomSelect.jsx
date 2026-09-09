/** Dropdown select with a floating glass popover and full keyboard support. */
import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

function norm(opt) {
  return typeof opt === 'object' ? opt : { value: opt, label: opt };
}

export default function CustomSelect({ value, onChange, options = [], placeholder = 'Select', className = '', label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const opts = options.map(norm);
  const selectedIdx = opts.findIndex((o) => o.value === value);
  const selected = opts[selectedIdx];
  const displayLabel = selected ? selected.label : placeholder;

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!isOpen || cursor < 0) return;
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor, isOpen]);

  const open = () => {
    setCursor(selectedIdx >= 0 ? selectedIdx : 0);
    setIsOpen(true);
  };

  const commit = (idx) => {
    if (idx < 0 || idx >= opts.length) return;
    onChange(opts[idx].value);
    setIsOpen(false);
  };

  const onKeyDown = (e) => {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCursor((c) => Math.min(opts.length - 1, c + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        break;
      case 'Home':
        e.preventDefault();
        setCursor(0);
        break;
      case 'End':
        e.preventDefault();
        setCursor(opts.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(cursor);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
    }
  };

  const isFiltered = selected && selected.value !== '';

  return (
    <div className={`relative ${className}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={label}
        className={`field w-full h-9 pl-3 pr-2.5 text-[13px] flex items-center justify-between gap-2 cursor-pointer ${
          isFiltered ? 'text-[var(--text)] border-[var(--accent-ring)]' : 'text-[var(--text-2)]'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--text-3)] transition-transform duration-[var(--dur-2)] ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-activedescendant={cursor >= 0 ? `${listId}-${cursor}` : undefined}
          className="glass-raised absolute left-0 right-0 mt-1.5 z-50 min-w-[220px] max-h-64 overflow-y-auto p-1 animate-drop-in"
        >
          {opts.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isCursor = idx === cursor;
            return (
              <li
                key={idx}
                id={`${listId}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setCursor(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(idx)}
                className={`h-8 px-2.5 rounded-md text-[13px] flex items-center justify-between gap-2 cursor-pointer ${
                  isCursor ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--text-2)]'
                } ${isSelected ? 'font-medium text-[var(--text)]' : ''}`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
