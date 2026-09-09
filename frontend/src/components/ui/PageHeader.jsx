import React from 'react';

/**
 * The one page header every view uses.
 *
 * Before this existed each page invented its own: titles ranged from `text-lg`
 * to `text-4xl` and casing drifted between "Team Accounts" and "Column schema",
 * so moving between tabs felt like moving between applications. Title casing is
 * sentence case and matches the sidebar label, so the nav item you clicked and
 * the heading you land on read as the same thing.
 *
 * `description` is where the page states what it is counting or showing --
 * it is the page's context line, not decoration, so keep it factual.
 */
export default function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl font-semibold text-[var(--text)] tracking-tight leading-tight">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">{description}</p>
        )}
        {children}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
