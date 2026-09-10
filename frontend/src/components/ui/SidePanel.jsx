import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * SidePanel / Drawer Primitive
 * Desktop: persistent or overlay side panel that docks to the right.
 * Mobile: full-screen slide-over drawer with swipe gesture or touch dismiss.
 */
export default function SidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
  children,
  width = 'max-w-xl',
  inline = false, // When true on desktop, renders inline in a split layout rather than a fixed overlay
  className = '',
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Inline mode: desktop renders side-by-side inside parent flex container
  if (inline) {
    return (
      <aside
        ref={panelRef}
        className={`w-full lg:w-[460px] xl:w-[500px] shrink-0 h-full flex flex-col bg-[var(--surface)] border-l border-[var(--edge)] overflow-hidden animate-fade-in ${className}`}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-[var(--edge)] flex items-start justify-between gap-3 bg-[var(--surface-2)]/60">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text)] tracking-tight truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[12px] text-[var(--text-2)] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="btn-ghost h-7 w-7 rounded-[var(--r-sm)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-4">
          {children}
        </div>
      </aside>
    );
  }

  // Floating Overlay Mode
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-[var(--ink)]/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={`w-full ${width} h-full glass-raised rounded-l-[var(--r-xl)] rounded-r-none border-y-0 border-r-0 flex flex-col overflow-hidden animate-rise-in ${className}`}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-[var(--edge)] flex items-start justify-between gap-3 bg-[var(--surface-2)]/70">
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-[var(--text)] tracking-tight truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[12px] text-[var(--text-2)] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="btn-ghost h-8 w-8 rounded-[var(--r-sm)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
