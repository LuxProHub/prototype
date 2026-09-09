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
  DATA_PROCESSOR: 'Data Processor',
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
    <header className="h-14 shrink-0 sticky top-0 z-30 glass-liquid rounded-none border-x-0 border-t-0 px-3 sm:px-6 flex items-center justify-between gap-3 shadow-xs">
      {/* Global Search with '/' Keyboard Shortcut Hint */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length > 0) {
              setActiveTab('records');
            }
          }}
          placeholder="Search records by name, developer, unit, phone..."
          aria-label="Search records"
          className="field w-full h-9 pl-9 pr-10 text-[12.5px] rounded-[var(--radius-md)] bg-[var(--color-surface)]/70 focus:bg-[var(--color-surface)]"
        />
        <div className="hidden sm:flex items-center absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="h-5 px-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[10.5px] font-mono text-[var(--color-text-muted)] leading-5">
            /
          </kbd>
        </div>
      </div>

      {/* Live Processing Engine Status (when a batch job is running) */}
      {activeJob && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-xs font-mono font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          <span>Job #{activeJob.id}</span>
          <span className="text-[11px] opacity-80 uppercase">{activeJob.status.toLowerCase()}</span>
        </div>
      )}

      {/* Session & Appearance Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRefresh}
          title="Refresh stats and pipeline"
          aria-label="Refresh stats and pipeline"
          className="btn-ghost hidden sm:inline-flex h-8 px-2.5 text-[12px] rounded-[var(--radius-md)] flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
          <span className="hidden lg:inline text-[var(--color-text-secondary)] font-medium">Refresh</span>
        </button>

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          className="btn-ghost h-8 w-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-transform active:scale-90"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>

        <div className="hidden sm:block h-5 w-px bg-[var(--color-border)] mx-1" />

        {/* User Identity Chip */}
        <div
          className="hidden sm:flex items-center gap-2.5 pl-1.5 select-none"
          title={`${fullName} (${ROLE_LABEL[role] || role})`}
        >
          <span className="w-8 h-8 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-[11.5px] font-bold flex items-center justify-center font-mono">
            {initials(fullName)}
          </span>
          <div className="hidden xl:block leading-tight text-left">
            <span className="block text-[12.5px] font-semibold text-[var(--color-text-primary)] max-w-[140px] truncate">
              {fullName}
            </span>
            <span className="block text-[10.5px] text-[var(--color-text-muted)] font-mono">
              {ROLE_LABEL[role] || role}
            </span>
          </div>
        </div>

        {/* Logout Action */}
        <button
          onClick={onLogout}
          title="Log out of DataLink"
          aria-label="Log out"
          className="btn-ghost h-8 w-8 rounded-[var(--radius-md)] hover:text-[var(--color-bad)] hover:bg-[var(--color-bad-soft,#fb718520)] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
