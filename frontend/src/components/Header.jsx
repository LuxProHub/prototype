import React from 'react';
import { Search, RefreshCw, Sun, Moon, LogOut } from 'lucide-react';

function initials(name) {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'A'
  );
}

const ROLE_LABEL = {
  VIEWER: 'Viewer',
  DATA_PROCESSOR: 'Data processor',
  ADMIN: 'Admin',
  CCO: 'CCO',
  CEO: 'CEO',
  DEVELOPER: 'Developer',
};

/**
 * The top bar. 48px, glass, and quiet: it holds search, a running-job pill
 * when there is one, and the session controls. It should never compete with
 * the page below it for attention -- the page is the product, this is chrome.
 */
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
    <header className="h-12 shrink-0 sticky top-0 z-30 glass rounded-none border-x-0 border-t-0 px-3 sm:px-4 flex items-center gap-3">
      {/* Search: a command-style field, not a hero input. */}
      <div className="relative flex-1 max-w-[440px]">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length > 0) setActiveTab('records');
          }}
          placeholder="Search records"
          aria-label="Search records"
          className="field w-full h-8 pl-8 pr-9 text-[12.5px] bg-[var(--surface-2)]/60"
        />
        <kbd className="hidden sm:flex absolute right-1.5 top-1/2 -translate-y-1/2 h-5 min-w-5 px-1 items-center justify-center rounded-[4px] border border-[var(--edge)] bg-[var(--surface)]/70 text-[10px] font-mono text-[var(--text-3)] pointer-events-none">
          /
        </kbd>
      </div>

      {activeJob && (
        <div className="hidden md:flex items-center gap-2 h-7 px-2.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-ring)] text-[11.5px] text-[var(--accent)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="num">Job {activeJob.id}</span>
          <span className="text-[var(--text-3)]">{String(activeJob.status || '').toLowerCase()}</span>
        </div>
      )}

      <div className="hidden sm:block flex-1" />

      {/* Session */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onRefresh}
          title="Refresh stats"
          aria-label="Refresh stats"
          className="btn-ghost hidden sm:inline-flex h-8 w-8"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          className="btn-ghost h-8 w-8"
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <div className="hidden sm:block h-4 w-px bg-[var(--edge)] mx-1" />

        <div
          className="hidden sm:flex items-center gap-2 pl-0.5 select-none"
          title={`${fullName} · ${ROLE_LABEL[role] || role}`}
        >
          {/* A rounded square, not a circle: the interface has enough dots. */}
          <span className="w-7 h-7 rounded-[7px] bg-[var(--accent-soft)] border border-[var(--accent-ring)] text-[var(--accent)] text-[11px] font-semibold flex items-center justify-center">
            {initials(fullName)}
          </span>
          <div className="hidden lg:block leading-tight">
            <div className="text-[12px] font-medium text-[var(--text)] max-w-[140px] truncate">{fullName}</div>
            <div className="t-meta">{ROLE_LABEL[role] || role}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
          className="btn-ghost h-8 w-8 ml-0.5 hover:text-[var(--bad)]"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
