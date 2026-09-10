import React from 'react';

/**
 * Bento UI Component System
 * Provides modular information blocks with varying spans and liquid glass or panel styling.
 */
export function BentoGrid({ children, className = '' }) {
  return (
    <div className={`bento-grid ${className}`}>
      {children}
    </div>
  );
}

export function BentoCard({
  title,
  subtitle,
  badge,
  icon,
  children,
  colSpan = 1,
  rowSpan = 1,
  variant = 'solid', // 'solid' | 'glass' | 'interactive'
  className = '',
  onClick,
}) {
  const colSpanClasses = {
    1: 'col-span-1',
    2: 'col-span-1 sm:col-span-2',
    3: 'col-span-1 sm:col-span-2 lg:col-span-3',
    4: 'col-span-1 sm:col-span-2 lg:col-span-4',
  }[colSpan] || 'col-span-1';

  const rowSpanClasses = {
    1: 'row-span-1',
    2: 'row-span-2',
  }[rowSpan] || 'row-span-1';

  const variantClass = {
    solid: 'bento-card',
    glass: 'bento-card bento-card-glass',
    interactive: 'bento-card cursor-pointer hover:border-[var(--accent-soft)] hover:-translate-y-0.5',
  }[variant] || 'bento-card';

  return (
    <div
      onClick={onClick}
      className={`${variantClass} ${colSpanClasses} ${rowSpanClasses} flex flex-col justify-between ${className}`}
    >
      {(title || icon || badge) && (
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="shrink-0 text-[var(--accent)]">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h3 className="text-xs sm:text-sm font-semibold text-[var(--text)] tracking-tight truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11px] text-[var(--text-3)] truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col justify-center">
        {children}
      </div>
    </div>
  );
}
