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
    <aside className="app-rail hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 z-30 select-none bg-[var(--surface)]/85 dark:bg-[#0a0f1d]/75 backdrop-blur-2xl border-r border-[var(--edge)] dark:border-white/10 shadow-[8px_0_24px_-10px_rgba(0,0,0,0.05)] dark:shadow-[8px_0_32px_-10px_rgba(0,0,0,0.85)]">
      {/* Brand */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--edge)] dark:border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-transparent border border-blue-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.25)]">
            <DataLinkLogo className="w-4.5 h-4.5 text-[var(--accent)]" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-bold text-[var(--text)] tracking-tight">DataLink</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--ok)] animate-pulse" />
            </div>
            <div className="text-[10.5px] text-[var(--text-3)] font-mono tracking-tight">Register Engine</div>
          </div>
        </div>

        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--edge)]">
          v2.4
        </span>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Primary">
        {GROUPS.map((group) => {
          const items = visibleItems.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <div className="px-2.5 mb-1.5 text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                {group}
              </div>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === 'jobs' && activeJob;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative w-full h-8.5 px-2.5 rounded-lg flex items-center gap-2.5 text-[12.5px] cursor-pointer transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-600/12 text-white font-semibold border border-blue-500/25 shadow-[0_2px_12px_-3px_rgba(37,99,235,0.3)]'
                            : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] border border-transparent'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                        )}
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                            isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)] group-hover:text-[var(--text)]'
                          }`}
                          strokeWidth={isActive ? 2 : 1.75}
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {hasBadge && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
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

      {/* Engine status dock */}
      <div className="p-3 border-t border-[var(--edge)] dark:border-white/10 bg-transparent">
        <div className="px-3 py-2.5 rounded-lg bg-[var(--surface-2)] dark:bg-white/[0.03] backdrop-blur-md border border-[var(--edge)] dark:border-white/[0.08] hover:border-[var(--edge-strong)] dark:hover:border-white/[0.15] transition-colors flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ok)] opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ok)] shadow-[0_0_8px_var(--ok)]" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-[11.5px] font-semibold text-[var(--text)] truncate">PostgreSQL 18</div>
              <div className="text-[10px] text-[var(--ok)] font-medium">Local · Connected</div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-3)] bg-[var(--surface-3)] dark:bg-white/[0.04] px-1.5 py-0.5 rounded border border-[var(--edge)] dark:border-white/[0.06]">5432</span>
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-liquid rounded-none border-x-0 border-b-0 px-1 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] flex items-center justify-around overflow-x-auto shadow-2xl"
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
            className={`relative flex flex-col items-center justify-center min-w-[50px] py-1 px-1.5 rounded-[var(--r-md)] transition-all ${
              isActive
                ? 'text-[var(--accent)] font-bold'
                : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <span
              className={`p-1.5 rounded-[var(--r-md)] ${
                isActive ? 'bg-[var(--accent-soft)] shadow-sm' : ''
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[52px]">
              {item.shortLabel}
            </span>
            {hasBadge && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-[var(--accent)] rounded-full animate-ping" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
