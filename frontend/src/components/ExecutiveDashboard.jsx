import React, { useCallback, useEffect, useState } from 'react';
import {
  Phone,
  Users,
  AlertTriangle,
  ShieldCheck,
  Award,
  Layers,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { apiFetch } from '../lib/api';
import { ErrorState } from './ui/States';

const STAGE_ORDER = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'NEGOTIATING',
  'WON',
  'LOST',
  'DO_NOT_CONTACT',
];

const STAGE_LABELS = {
  NEW: 'Ready',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  NEGOTIATING: 'Negotiating',
  WON: 'Won',
  LOST: 'Lost',
  DO_NOT_CONTACT: 'Do Not Contact',
};

const STAGE_COLORS = {
  NEW: 'bg-[var(--color-accent)]',
  CONTACTED: 'bg-sky-500',
  INTERESTED: 'bg-[var(--color-warn)]',
  NEGOTIATING: 'bg-amber-500',
  WON: 'bg-[var(--color-ok)]',
  LOST: 'bg-slate-500',
  DO_NOT_CONTACT: 'bg-[var(--color-bad)]',
};

export default function ExecutiveDashboard() {
  const [team, setTeam] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, p] = await Promise.all([
        apiFetch(`/api/analytics/team?days=${days}`),
        apiFetch('/api/analytics/pipeline'),
      ]);
      if (t.status === 403 || p.status === 403) {
        setError('Executive analytics requires CCO, CEO, or Developer authorization.');
        return;
      }
      if (!t.ok || !p.ok) throw new Error('Could not load analytics data.');
      setTeam(await t.json());
      setPipeline(await p.json());
    } catch (err) {
      setError(err.message || 'Failed to fetch executive analytics.');
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !pipeline && !team) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader title="Executive view" description="Team productivity and lead pipeline performance." />
        <ErrorState error={error} onRetry={load} title="Analytics could not be loaded" />
      </div>
    );
  }

  const openLeads = pipeline?.open_leads ?? 0;
  const overdueActions = pipeline?.overdue_actions ?? 0;
  const totalActivities = team?.totals?.activities ?? 0;
  const contactsDisproved = pipeline?.contacts_disproved ?? 0;
  const totalStageCount = pipeline?.by_stage
    ? Object.values(pipeline.by_stage).reduce((a, b) => a + b, 0)
    : 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-[1520px] mx-auto animate-fade-in">
      {/* Page Header with Time Window Selector */}
      <PageHeader
        title="Executive view"
        description="Who is calling, what they hold, and what the calls proved."
        actions={
          <div className="flex items-center gap-1.5 bg-[var(--color-surface-elevated)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`px-3 py-1 rounded-[var(--radius-sm)] text-[12px] font-semibold transition-all cursor-pointer ${
                  days === d
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad)] text-xs font-semibold border border-[var(--color-bad)]/30">
          {error}
        </div>
      )}

      {/* Bento Executive Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Bento 1: Contacts Disproved (Hero Proof-of-Value Card) */}
        <div className="bento-card p-5 flex flex-col justify-between group border-[var(--color-ok)]/30 bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-ok)_10%)]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="neo-tag bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30">
                Data Quality ROI
              </span>
              <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                Contacts Disproved & Proven
              </div>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-ok-soft,#34d39920)] text-[var(--color-ok)] border border-[var(--color-ok)]/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-3xl font-bold num text-[var(--color-ok)] tracking-tight">
              {contactsDisproved.toLocaleString()}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-secondary)] mt-1 font-medium">
              Bad numbers cleansed by calling
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Direct registry gain</span>
            <span className="font-semibold text-[var(--color-ok)]">Verified Live</span>
          </div>
        </div>

        {/* Bento 2: Open Leads */}
        <div className="bento-card p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="neo-tag">Active Pipeline</span>
              <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                Open Leads Held
              </div>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent)]/30">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-3xl font-bold num text-[var(--color-text-primary)] tracking-tight">
              {openLeads.toLocaleString()}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-1">
              Currently assigned to sales desk
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Coverage</span>
            <span className="font-mono text-[var(--color-text-primary)]">Active Outreach</span>
          </div>
        </div>

        {/* Bento 3: Overdue Actions */}
        <div className="bento-card p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="neo-tag">SLA Monitoring</span>
              <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                Overdue Callbacks
              </div>
            </div>
            <div
              className={`p-2.5 rounded-[var(--radius-md)] border ${
                overdueActions > 0
                  ? 'bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad)] border-[var(--color-bad)]/30'
                  : 'bg-[var(--color-ok-soft,#34d39920)] text-[var(--color-ok)] border-[var(--color-ok)]/30'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div
              className={`text-3xl font-bold num tracking-tight ${
                overdueActions > 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-text-primary)]'
              }`}
            >
              {overdueActions}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-1">
              {overdueActions > 0 ? 'Past scheduled callback deadline' : 'Zero overdue actions'}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Desk health</span>
            <span
              className={`font-semibold ${overdueActions > 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-ok)]'}`}
            >
              {overdueActions > 0 ? 'Action Required' : 'On Track'}
            </span>
          </div>
        </div>

        {/* Bento 4: Total Logged Activities */}
        <div className="bento-card p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="neo-tag">Desk Effort</span>
              <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                Total Activities Logged
              </div>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-value-soft,#d6a85b20)] text-[var(--color-value)] border border-[var(--color-value)]/30">
              <Phone className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-3xl font-bold num text-[var(--color-text-primary)] tracking-tight">
              {totalActivities.toLocaleString()}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-1">
              Calls, notes & verdicts in last {days} days
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Window</span>
            <span className="font-mono text-[var(--color-text-primary)]">Last {days} Days</span>
          </div>
        </div>
      </div>

      {/* Middle Bento Section: Pipeline Stage Funnel & Breakdown */}
      {pipeline && (
        <div className="bento-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Pipeline Lifecycle Distribution
              </h3>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">
              Total Active: {totalStageCount.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {STAGE_ORDER.map((stage) => {
              const count = pipeline.by_stage?.[stage] ?? 0;
              const pct = totalStageCount > 0 ? Math.round((count / totalStageCount) * 100) : 0;
              return (
                <div
                  key={stage}
                  className="panel p-3.5 rounded-[var(--radius-md)] space-y-2 border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[stage] || 'bg-slate-400'}`} />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {STAGE_LABELS[stage] || stage}
                      </span>
                    </div>
                    <div className="text-2xl font-bold num text-[var(--color-text-primary)] mt-1">
                      {count.toLocaleString()}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)] font-mono">
                    <span>{pct}%</span>
                    <span>share</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Bento: Team Productivity Matrix */}
      {team && (
        <div className="bento-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--color-value)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Team Member Performance Matrix
              </h3>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] font-medium">
              {team.people?.length || 0} active operators in window
            </span>
          </div>

          {!team.people?.length ? (
            <div className="p-8 text-center border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] text-xs text-[var(--color-text-muted)] font-mono">
              No outreach activity logged in the selected {days}-day window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-[11px]">
                    <th className="pb-3 font-semibold">OPERATOR</th>
                    <th className="pb-3 font-semibold text-center">CALLS</th>
                    <th className="pb-3 font-semibold text-center">ALL ACTIVITIES</th>
                    <th className="pb-3 font-semibold text-center">LEADS HELD</th>
                    <th className="pb-3 font-semibold text-center text-[var(--color-ok)]">WON DEALS</th>
                    <th className="pb-3 font-semibold text-right">DISPROVED BAD DATA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] font-sans">
                  {team.people.map((p) => {
                    const disprovedCount = ['WRONG_NUMBER', 'NOT_OWNER', 'SOLD'].reduce(
                      (n, v) => n + (p.verdicts_given?.[v] || 0),
                      0
                    );

                    return (
                      <tr key={p.user} className="hover:bg-[var(--color-accent-soft)] transition-colors">
                        <td className="py-3 font-semibold text-[var(--color-text-primary)]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[10.5px] font-bold flex items-center justify-center text-[var(--color-accent)] font-mono">
                              {p.user?.slice(0, 2).toUpperCase() || 'OP'}
                            </span>
                            <span>{p.user}</span>
                          </div>
                        </td>
                        <td className="py-3 text-center font-mono num font-semibold text-[var(--color-text-primary)]">
                          {p.activities?.CALL || 0}
                        </td>
                        <td className="py-3 text-center font-mono num text-[var(--color-text-secondary)]">
                          {p.total_activities || 0}
                        </td>
                        <td className="py-3 text-center font-mono num font-semibold text-[var(--color-accent)]">
                          {p.leads_held || 0}
                        </td>
                        <td className="py-3 text-center font-mono num font-bold text-[var(--color-ok)]">
                          {p.leads_by_stage?.WON || 0}
                        </td>
                        <td className="py-3 text-right">
                          <span className="inline-flex items-center gap-1 font-mono num font-semibold text-[var(--color-ok)] bg-[var(--color-ok-soft,#34d39920)] px-2.5 py-0.5 rounded-full border border-[var(--color-ok)]/25">
                            +{disprovedCount} cleaned
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
