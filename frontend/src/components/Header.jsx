/** Top bar: global search, engine status, session controls. */
import React from 'react';
import { Search, RefreshCw, Sun, Moon, LogOut } from 'lucide-react';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'A';
}

const ROLE_LABEL = {
  VIEWER: 'Viewer',
  DATA_PROCESSOR: 'Data processor',
  ADMIN: 'Admin',
  CCO: 'CCO',
  CEO: 'CEO',
  DEVELOPER: 'Developer',
};

export default function Header({
  onRefresh,
  activeJob,
  searchQuery,
  setSearchQuery,
  setActiveTab,
  theme,
  toggleTheme,
  onLogout,
  currentUser,
}) {
  const isDark = theme === 'dark';
  const role = currentUser?.role || 'ADMIN';
  const fullName = currentUser?.full_name || 'Admin Operator';

  return (
    <header className="h-14 shrink-0 sticky top-0 z-20 glass rounded-none border-x-0 border-t-0 px-3 sm:px-5 flex items-center gap-3">
      {/* Global search — typing jumps to Records, which owns the debounce. */}
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length > 0) {
              setActiveTab('records');
            }
          }}
          placeholder="Search records"
          aria-label="Search records"
          className="field w-full h-9 pl-9 pr-3 text-[13px]"
        />
      </div>

      {/* Live status — only when a job is actually running. Idle is silent. */}
      {activeJob && (
        <div className="hidden lg:flex badge badge-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="num">Job #{activeJob.id}</span>
          <span>{activeJob.status.toLowerCase()}</span>
        </div>
      )}

      <div className="hidden sm:block flex-1" />

      {/* Session controls */}
      <div className="flex items-center gap-1">
        <button onClick={onRefresh} title="Refresh stats" className="btn-ghost hidden sm:inline-flex h-9 px-2.5 text-[13px]">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          className="btn-ghost h-9 w-9"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="hidden sm:block h-5 w-px bg-[var(--edge-strong)] mx-1.5" />

        <div className="hidden sm:flex items-center gap-2.5 pl-1" title={`${fullName} (${ROLE_LABEL[role] || role})`}>
          <span className="w-8 h-8 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-ring)] text-[var(--accent)] text-[11px] font-semibold flex items-center justify-center select-none">
            {initials(fullName)}
          </span>
          <span className="hidden lg:block leading-tight">
            <span className="block text-[13px] font-medium text-[var(--text)] max-w-[160px] truncate">{fullName}</span>
            <span className="block text-[11px] text-[var(--text-3)]">{ROLE_LABEL[role] || role}</span>
          </span>
        </div>

        <button onClick={onLogout} title="Log out" aria-label="Log out" className="btn-ghost h-9 w-9 ml-1 hover:text-[var(--bad)]">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
