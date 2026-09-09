import React from 'react';

/**
 * Premium PageHeader Component
 * Supports title, description, category/status badge, breadcrumb, and actions slot.
 */
export default function PageHeader({
  title,
  description,
  badge,
  breadcrumbs,
  actions,
  children,
  className = '',
}) {
  return (
    <div className={`flex-shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 ${className}`}>
      <div className="min-w-0 space-y-1">
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] mb-1">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="opacity-40">/</span>}
                {crumb.onClick ? (
                  <button onClick={crumb.onClick} className="hover:text-[var(--color-text-primary)] transition-colors">
                    {crumb.label}
                  </button>
                ) : (
                  <span className={idx === breadcrumbs.length - 1 ? 'text-[var(--color-text-secondary)] font-medium' : ''}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] tracking-tight leading-tight">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        {description && (
          <p className="text-[12.5px] text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}

        {children}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
