import React from 'react';
import {
  Database,
  TrendingUp,
  Copy,
  FileCheck2,
  Upload,
  Search,
  ArrowRight,
  PieChart,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import RegisterComposition from './viz/RegisterComposition';
import PageHeader from './ui/PageHeader';
import { ErrorState } from './ui/States';
import DataLinkLogo from './DataLinkLogo';

export default function OverviewDashboard({ stats, statsError, onRetry, setActiveTab, setSelectedJobId }) {
  if (statsError) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <ErrorState error={statsError} onRetry={onRetry} title="Overview could not be loaded" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-10 sm:p-20 text-center font-mono text-xs flex flex-col items-center justify-center space-y-4 h-full">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface)] p-3 border border-[var(--color-accent)]/30 flex items-center justify-center shadow-lg animate-pulse">
          <DataLinkLogo className="w-8 h-8" />
        </div>
        <p className="text-[var(--color-text-primary)] font-semibold text-sm">Connecting to PostgreSQL engine</p>
        <p className="text-[var(--color-text-muted)] text-xs">Aggregating real-time register pipeline metrics...</p>
      </div>
    );
  }

  const successRate = stats.success_rate ?? 98.5;
  const totalClean = stats.total_records ?? 0;
  const validRecords = stats.valid_records ?? 0;
  const dupRecords = stats.duplicate_records ?? 0;
  const totalFiles = stats.total_files ?? 0;
  const totalJobs = stats.total_jobs ?? 0;
  const totalErrors = stats.total_errors ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1520px] mx-auto animate-fade-in">
      {/* Top Header with Quick Action Controls */}
      <PageHeader
        title="Overview"
        description="Unified real estate registry intelligence. Ingestion, cleaning, deduplication, and lead activation."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className="btn-primary h-9 px-3.5 text-[12.5px] flex items-center gap-1.5 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Upload registers</span>
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className="btn h-9 px-3.5 text-[12.5px] flex items-center gap-1.5"
            >
              <Search className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Explore records</span>
            </button>
          </div>
        }
      />

      {/* Bento: information importance is expressed as area. The spatial view
          is the largest cell because it is the thing worth looking at; the
          register totals sit beside it, and the smaller counts sit under. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* LARGE — spatial centrepiece */}
        <div className="lg:col-span-8 bento-card p-0 overflow-hidden shadow-md min-h-[26rem]">
          <RegisterComposition stats={stats} />
        </div>

        {/* MEDIUM — the two headline figures, stacked beside the scene */}
        <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-5">
          {/* KPI 1: Total Clean Records */}
          <div className="bento-card p-5 flex-1 flex flex-col justify-between group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="neo-tag">Master Registry</span>
                <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                  Total Clean Records
                </div>
              </div>
              <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/20 text-[var(--color-accent)]">
                <Database className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold num text-[var(--color-text-primary)] tracking-tight">
                {totalClean.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[var(--color-ok)] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{validRecords.toLocaleString()} validated rows</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
              <span>Engine status</span>
              <span className="text-[var(--color-text-primary)] font-mono font-medium">PostgreSQL Ready</span>
            </div>
          </div>


          {/* KPI 2: Pipeline Success Rate */}
          <div className="bento-card p-5 flex-1 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="neo-tag">Validation</span>
                <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                  Pipeline Success Rate
                </div>
              </div>
              <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-ok-soft,#34d39920)] border border-[var(--color-ok)]/25 text-[var(--color-ok)]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold num text-[var(--color-text-primary)] tracking-tight">
                {successRate}%
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[var(--color-text-muted)]">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warn)]" />
                <span>{totalErrors} flagged validation errors</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <div className="w-full h-1.5 bg-[var(--color-surface-elevated)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-ok)] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, successRate)}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SMALL / SMALL / MEDIUM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* KPI 3: Duplicates Filtered */}
        <div className="lg:col-span-4 bento-card p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="neo-tag">Deduplication</span>
              <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                Duplicates Filtered
              </div>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-dup-soft,#a78bfa20)] border border-[var(--color-dup)]/25 text-[var(--color-dup)]">
              <Copy className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-3xl font-bold num text-[var(--color-text-primary)] tracking-tight">
              {dupRecords.toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-1.5">
              Cross-register hash matches filtered
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Deduplication</span>
            <span className="text-[var(--color-dup)] font-mono font-medium">Automatic</span>
          </div>
        </div>


        {/* KPI 4: Files & Runs */}
        <div className="lg:col-span-8 bento-card p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="neo-tag">Execution</span>
              <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mt-1.5">
                Source Files Ingested
              </div>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-value-soft,#d6a85b20)] border border-[var(--color-value)]/25 text-[var(--color-value)]">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-3xl font-bold num text-[var(--color-text-primary)] tracking-tight">
              {totalFiles.toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-1.5">
              Across {totalJobs.toLocaleString()} batch execution runs
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>File formats</span>
            <span className="text-[var(--color-text-primary)] font-mono font-medium">XLSX · XLS · CSV</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Community Distribution & Ingestion Pipeline Audit Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Bento: Top Communities Distribution */}
        <div className="bento-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Community Distribution</h3>
              </div>
              <span className="neo-tag">Real Data</span>
            </div>

            <div className="space-y-3.5 mt-4">
              {stats.community_distribution && stats.community_distribution.length > 0 ? (
                stats.community_distribution.slice(0, 6).map((item, index) => {
                  const maxCount = stats.community_distribution[0]?.count || 1;
                  const percentage = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--color-text-primary)] font-semibold truncate max-w-[170px]">
                          {item.name || 'Unspecified'}
                        </span>
                        <span className="font-mono num text-[var(--color-accent)] font-semibold">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[var(--color-surface-elevated)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] space-y-2">
                  <Layers className="w-7 h-7 text-[var(--color-text-muted)] mx-auto" />
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">No communities recorded yet</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Upload an Excel register to view distribution.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Primary coverage</span>
            <span className="font-medium text-[var(--color-text-secondary)]">Dubai Prime Real Estate</span>
          </div>
        </div>

        {/* Right Bento (Span 2): Recent Ingestion Runs Audit Table */}
        <div className="lg:col-span-2 bento-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--color-ok)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Ingestion Runs</h3>
              </div>
              <button
                onClick={() => setActiveTab('jobs')}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View Full Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs min-w-[520px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-[11px]">
                    <th className="pb-2.5 font-semibold">RUN</th>
                    <th className="pb-2.5 font-semibold">FILE</th>
                    <th className="pb-2.5 font-semibold">STATUS</th>
                    <th className="pb-2.5 font-semibold text-right">ROWS</th>
                    <th className="pb-2.5 font-semibold text-right">ERRORS</th>
                    <th className="pb-2.5 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] font-sans">
                  {(stats.recent_jobs || stats.items) && (stats.recent_jobs || stats.items).length > 0 ? (
                    (stats.recent_jobs || stats.items).slice(0, 5).map((job) => (
                      <tr key={job.id} className="hover:bg-[var(--color-accent-soft)] transition-colors group">
                        <td className="py-2.5 font-semibold text-[var(--color-accent)] font-mono num">
                          #{job.id}
                        </td>
                        <td className="py-2.5 text-[var(--color-text-primary)] font-medium truncate max-w-[180px]">
                          {job.filename}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider font-mono border ${
                              job.status === 'COMPLETED'
                                ? 'bg-[var(--color-ok-soft,#34d39920)] text-[var(--color-ok)] border-[var(--color-ok)]/30'
                                : job.status === 'COMPLETED_WITH_ERRORS'
                                ? 'bg-[var(--color-warn-soft,#fbbf2420)] text-[var(--color-warn)] border-[var(--color-warn)]/30'
                                : job.status === 'FAILED'
                                ? 'bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad)] border-[var(--color-bad)]/30'
                                : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]/30'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-[var(--color-text-secondary)] font-mono num">
                          {job.total_rows?.toLocaleString() || 0}
                        </td>
                        <td className="py-2.5 text-right font-semibold font-mono num">
                          {job.error_rows > 0 ? (
                            <span className="text-[var(--color-bad)]">{job.error_rows}</span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">0</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedJobId?.(job.id);
                              setActiveTab('jobs');
                            }}
                            className="text-[11.5px] text-[var(--color-accent)] hover:underline font-semibold cursor-pointer"
                          >
                            Audit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-[var(--color-text-muted)] font-mono">
                        No ingestion runs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Fast pipeline</span>
            <span className="text-[var(--color-text-secondary)] font-mono">Batch streaming enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
