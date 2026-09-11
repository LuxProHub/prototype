import React from 'react';
import { Search, RefreshCw, Sun, Moon, LogOut, Shield } from 'lucide-react';
import { ROLE_LABEL } from '../lib/labels';

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

const ROLE_THEME = {
  ADMIN: 'border-blue-500/40 text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
  DEVELOPER: 'border-purple-500/40 text-purple-400 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.15)]',
  CEO: 'border-amber-500/40 text-amber-400 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
  CCO: 'border-amber-500/40 text-amber-400 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
  DATA_PROCESSOR: 'border-slate-500/40 text-slate-300 bg-slate-500/10',
  VIEWER: 'border-slate-500/30 text-slate-400 bg-slate-500/10',
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
  const avatarTheme = ROLE_THEME[role] || ROLE_THEME.ADMIN;

  return (
    <header className="command-bar h-13 shrink-0 sticky top-0 z-30 glass border-b border-[var(--edge)] px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Search: Spatial Command Input */}
      <div className="relative flex-1 max-w-[500px]">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length > 0) setActiveTab('records');
          }}
          placeholder="Search 6.4M records across UAE registers..."
          aria-label="Search records"
          className="field w-full h-8.5 pl-9 pr-10 text-[12.5px] bg-[var(--surface-2)]/80 hover:bg-[var(--surface-2)] border-[var(--edge)] focus:border-[var(--accent)] rounded-lg transition-all"
        />
        <kbd className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 h-5 px-1.5 items-center justify-center rounded border border-[var(--edge)] bg-[var(--surface)] text-[10px] font-mono text-[var(--text-3)] pointer-events-none shadow-sm">
          /
        </kbd>
      </div>

      {/* Active Job Telemetry Pill */}
      {activeJob && (
        <div className="hidden md:flex items-center gap-2 h-7.5 px-3 rounded-full bg-blue-600/10 border border-blue-500/30 text-[11.5px] text-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.2)] animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span className="num font-semibold">Job #{activeJob.id}</span>
          <span className="text-[var(--text-3)]">·</span>
          <span className="text-[var(--text-2)] font-medium capitalize">{String(activeJob.status || '').toLowerCase()}</span>
        </div>
      )}

      {/* Session Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRefresh}
          title="Refresh Data & Metrics"
          aria-label="Refresh stats"
          className="btn-ghost h-8 w-8 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          className="btn-ghost h-8 w-8 rounded-lg"
        >
          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
        </button>

        <div className="hidden sm:block h-4 w-px bg-[var(--edge)] mx-1" />

        {/* User Identity Chip with Role Badge */}
        <div
          className="hidden sm:flex items-center gap-2.5 pl-1 select-none"
          title={`${fullName} · ${ROLE_LABEL[role] || role}`}
        >
          <span
            className={`w-7.5 h-7.5 rounded-lg border flex items-center justify-center font-bold text-[11px] font-mono ${avatarTheme}`}
          >
            {initials(fullName)}
          </span>
          <div className="hidden lg:block leading-tight text-left">
            <div className="text-[12.5px] font-semibold text-[var(--text)] max-w-[130px] truncate">{fullName}</div>
            <div className="text-[10px] text-[var(--text-3)] font-medium tracking-wide flex items-center gap-1">
              <Shield className="w-2.5 h-2.5 text-[var(--accent)]" />
              <span>{ROLE_LABEL[role] || role}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Log out session"
          aria-label="Log out"
          className="btn-ghost h-8 w-8 rounded-lg ml-1 hover:text-[var(--bad)] hover:bg-[var(--bad-soft)]"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
