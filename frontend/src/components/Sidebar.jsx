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
    <aside
      aria-label="Navigation Sidebar"
      className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 z-40 select-none bg-[var(--color-surface)] border-r border-[var(--color-border)] shadow-xs"
    >
      {/* Brand Identity Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40">
        <div className="w-8 h-8 rounded-xl bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 flex items-center justify-center shrink-0 shadow-xs">
          <DataLinkLogo className="w-5 h-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-bold text-[var(--color-text-primary)] tracking-tight">
            DataLink
          </div>
          <div className="text-[10.5px] font-mono text-[var(--color-text-muted)]">
            Spatial Data Platform
          </div>
        </div>
      </div>

      {/* Grouped Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4" aria-label="Primary">
        {GROUPS.map((group) => {
          const items = visibleItems.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="space-y-1">
              <div className="px-2.5 text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                {group}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === 'jobs' && activeJob;

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`relative w-full h-[36px] px-2.5 rounded-[var(--radius-md)] flex items-center gap-2.5 text-[12.5px] cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] font-semibold shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--color-accent)] shadow-xs" />
                        )}
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                          }`}
                          strokeWidth={isActive ? 2.4 : 1.8}
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {hasBadge && (
                          <span className="badge badge-accent text-[10px] py-0.5 px-1.5 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                            run
                          </span>
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

      {/* Engine Status Bottom Well */}
      <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30">
        <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-ok)] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-ok)]" />
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-[11.5px] font-bold text-[var(--color-text-primary)]">
              PostgreSQL Engine
            </div>
            <div className="text-[10px] font-mono text-[var(--color-ok)] truncate">
              Connected & Healthy
            </div>
          </div>
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
