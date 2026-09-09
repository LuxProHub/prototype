import React from 'react';
import DataLinkLogo from './DataLinkLogo';
import { navItems } from '../lib/nav';

const RANK = { VIEWER: 1, DATA_PROCESSOR: 2, ADMIN: 3, CCO: 4, CEO: 5, DEVELOPER: 6 };

function visibleFor(userRole) {
  const rank = RANK[userRole] || 0;
  return navItems.filter((i) => !i.minRank || rank >= i.minRank);
}

const GROUPS = ['Workspace', 'Pipeline', 'Admin'];

export default function Sidebar({ activeTab, setActiveTab, activeJob, userRole }) {
  const visibleItems = visibleFor(userRole);

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col h-screen sticky top-0 z-30 select-none bg-[var(--surface)]/70 backdrop-blur-md border-r border-[var(--edge)]">
      {/* Brand */}
      <div className="h-12 px-3.5 flex items-center gap-2.5 border-b border-[var(--edge)]">
        <div className="w-7 h-7 rounded-[7px] bg-[var(--accent-soft)] border border-[var(--accent-ring)] flex items-center justify-center shrink-0">
          <DataLinkLogo className="w-4 h-4" />
        </div>
        <div className="leading-none min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text)] tracking-tight">DataLink</div>
          <div className="t-meta mt-[3px]">Register engine</div>
        </div>
      </div>

      {/* Navigation, grouped by what the operator is doing. Group labels are
          sentence case in the interface face; they are wayfinding, not badges. */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4" aria-label="Primary">
        {GROUPS.map((group) => {
          const items = visibleItems.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <div className="px-2 mb-1 t-label">{group}</div>
              <ul className="space-y-px">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === 'jobs' && activeJob;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`relative w-full h-8 pl-2.5 pr-2 rounded-[var(--r-md)] flex items-center gap-2.5 text-[12.5px] cursor-pointer transition-colors duration-[var(--dur-1)] ${
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--text)] font-medium'
                            : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--accent)]" />
                        )}
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}
                          strokeWidth={1.75}
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {hasBadge && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" aria-label="Running" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Engine status. A line, not a card: it is a fact, not a module. */}
      <div className="px-3.5 py-3 border-t border-[var(--edge)] flex items-center gap-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ok)] opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ok)]" />
        </span>
        <div className="leading-tight min-w-0">
          <div className="text-[12px] text-[var(--text)]">PostgreSQL</div>
          <div className="t-meta">Connected</div>
        </div>
      </div>
    </aside>
  );
}

/** Native mobile bottom navigation bar (< md). Floats over content with Liquid Glass. */
export function MobileBottomNav({ activeTab, setActiveTab, activeJob, userRole }) {
  const visibleItems = visibleFor(userRole);
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-liquid rounded-none border-x-0 border-b-0 px-1 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] flex items-center justify-around overflow-x-auto shadow-lg"
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const hasBadge = item.id === 'jobs' && activeJob;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center min-w-[50px] py-1 px-1.5 rounded-[var(--radius-md)] transition-all ${
              isActive
                ? 'text-[var(--color-accent)] font-bold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span
              className={`p-1.5 rounded-[var(--radius-md)] ${
                isActive ? 'bg-[var(--color-accent-soft)]' : ''
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.4 : 1.8} />
            </span>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[52px]">
              {item.shortLabel}
            </span>
            {hasBadge && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-[var(--color-accent)] rounded-full animate-ping" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
