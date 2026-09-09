import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible Modal Dialog Component
 * Uses Liquid Glass raised elevation, escape key listener, and click-outside dismissal.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  className = '',
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 bg-[var(--color-bg)]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        ref={modalRef}
        className={`w-full ${maxWidth} glass-raised rounded-[var(--radius-xl)] flex flex-col overflow-hidden shadow-2xl animate-rise-in ${className}`}
      >
        {(title || onClose) && (
          <div className="shrink-0 px-5 py-4 border-b border-[var(--color-border)] flex items-start justify-between gap-3 bg-[var(--color-surface-elevated)]/60">
            <div className="min-w-0">
              {title && (
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[12px] text-[var(--color-text-secondary)] truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="btn-ghost h-8 w-8 rounded-[var(--radius-sm)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
