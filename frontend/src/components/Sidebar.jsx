/** Fixed Navigation Sidebar with Role-Based Menu Items */
import React from 'react';
import {
  UsersRound,
  LineChart,
  PhoneCall,
  LayoutDashboard,
  Upload,
  Database,
  Activity,
  Layers,
} from 'lucide-react';
import DataLinkLogo from './DataLinkLogo';

export const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortLabel: 'Overview', group: 'Workspace' },
  { id: 'records', label: 'Records', icon: Database, shortLabel: 'Records', group: 'Workspace' },
  { id: 'queue', label: 'Call queue', icon: PhoneCall, shortLabel: 'Queue', group: 'Workspace' },
  { id: 'upload', label: 'Upload registers', icon: Upload, shortLabel: 'Upload', group: 'Pipeline' },
  { id: 'jobs', label: 'Processing jobs', icon: Activity, shortLabel: 'Jobs', group: 'Pipeline' },
  { id: 'mapping', label: 'Column schema', icon: Layers, shortLabel: 'Schema', group: 'Pipeline' },
  // Rank floors, mirroring UserRole.at_least on the server. Hiding a tab
  // the API would refuse anyway saves an operator a 403 they cannot act on.
  { id: 'team', label: 'Team accounts', icon: UsersRound, shortLabel: 'Team', group: 'Admin', minRank: 3 },
  { id: 'executive', label: 'Executive view', icon: LineChart, shortLabel: 'Exec', group: 'Admin', minRank: 4 },
];

// Mirrors UserRole.RANK on the server. The API is the control; this only
// avoids showing a tab that would answer 403.
const RANK = { VIEWER: 1, DATA_PROCESSOR: 2, ADMIN: 3, CCO: 4, CEO: 5, DEVELOPER: 6 };

function visibleFor(userRole) {
  const rank = RANK[userRole] || 0;
  return navItems.filter((i) => !i.minRank || rank >= i.minRank);
}

const GROUPS = ['Workspace', 'Pipeline', 'Admin'];

export default function Sidebar({ activeTab, setActiveTab, activeJob, userRole }) {
  const visibleItems = visibleFor(userRole);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 z-30 select-none bg-[var(--surface)] border-r border-[var(--edge)]">
      {/* Brand */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-[var(--edge)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-ring)] flex items-center justify-center shrink-0">
          <DataLinkLogo className="w-5 h-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-[var(--text)] tracking-tight">DataLink</div>
          <div className="text-[11px] text-[var(--text-3)]">Register engine</div>
        </div>
      </div>

      {/* Navigation, grouped by what the operator is doing */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Primary">
        {GROUPS.map((group) => {
          const items = visibleItems.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-4">
              <div className="px-2 mb-1.5 text-[11px] font-medium text-[var(--text-3)]">{group}</div>
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
                        className={`relative w-full h-[34px] px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] cursor-pointer transition-colors duration-[var(--dur-1)] ${
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--text)] font-medium'
                            : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--accent)]" />
                        )}
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {hasBadge && (
                          <span className="badge badge-accent">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                            running
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

      {/* Engine status */}
      <div className="p-3 border-t border-[var(--edge)]">
        <div className="well px-3 py-2.5 flex items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ok)] opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ok)]" />
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-[12px] font-medium text-[var(--text)]">Engine online</div>
            <div className="text-[11px] text-[var(--text-3)] truncate">Local PostgreSQL</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Native mobile bottom navigation bar (< md). Floats over content, so it earns glass. */
export function MobileBottomNav({ activeTab, setActiveTab, activeJob, userRole }) {
  const visibleItems = visibleFor(userRole);
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass rounded-none border-x-0 border-b-0 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex items-center justify-around overflow-x-auto"
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
            className={`relative flex flex-col items-center justify-center min-w-[52px] py-1 px-2 rounded-lg transition-colors ${
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <span className={`p-1.5 rounded-lg ${isActive ? 'bg-[var(--accent-soft)]' : ''}`}>
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span className="text-[10px] mt-0.5 font-medium">{item.shortLabel}</span>
            {hasBadge && <span className="absolute top-1 right-2 w-2 h-2 bg-[var(--accent)] rounded-full animate-ping" />}
          </button>
        );
      })}
    </nav>
  );
}
