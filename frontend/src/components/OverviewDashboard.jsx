import React from 'react';
import {
  Search,
  Upload,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import RegisterComposition from './viz/RegisterComposition';
import { ErrorState } from './ui/States';
import { humanize } from '../lib/labels';
import DataLinkLogo from './DataLinkLogo';

const TONES = {
  COMPLETED: 'ok',
  COMPLETED_WITH_ERRORS: 'warn',
  FAILED: 'bad',
  RUNNING: 'accent',
  PROCESSING: 'accent',
  PENDING: 'neutral',
};

export default function OverviewDashboard({
  stats,
  statsError,
  onRetry,
  setActiveTab,
  setSelectedJobId,
}) {
  if (statsError) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <ErrorState error={statsError} onRetry={onRetry} title="Registry Overview Unavailable" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-ring)] flex items-center justify-center animate-pulse">
          <DataLinkLogo className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <span className="text-[13px] font-medium text-[var(--text-3)] tracking-wide">
          Syncing registry intelligence...
        </span>
      </div>
    );
  }

  const total = stats.total_records || 0;
  const valid = stats.valid_records || 0;
  const dup = stats.duplicate_records || 0;
  const errors = stats.total_errors || 0;
  const incomplete = Math.max(0, total - valid - dup - errors);
  const health = stats.success_rate ?? (total ? (valid / total) * 100 : 0);

  const runs = (stats.recent_jobs || stats.items || []).slice(0, 5);

  const validPct = total ? ((valid / total) * 100).toFixed(1) : '0';
  const dupPct = total ? ((dup / total) * 100).toFixed(1) : '0';
  const incompletePct = total ? ((incomplete / total) * 100).toFixed(1) : '0';
  const errorPct = total ? ((errors / total) * 100).toFixed(2) : '0';

  return (
    <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      {/* Editorial Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[var(--edge)]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
            <span>Workspace</span>
            <span className="text-[var(--edge-strong)]">/</span>
            <span className="text-[var(--accent)]">Registry Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)] mt-1">
            Data Command Center
          </h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">
            Operational quality, cross-register deduplication, and pipeline throughput.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveTab('records')}
            className="btn h-9 px-3.5 gap-2"
          >
            <Search className="w-3.5 h-3.5 text-[var(--text-3)]" />
            <span>Explore Records</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className="btn-primary h-9 px-4 gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Ingest Register</span>
          </button>
        </div>
      </div>

      {/* DOMINANT BENTO VISUAL ANCHOR: The Core Data Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Dominant 8-column visual module */}
        <div className="lg:col-span-8 panel p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
          {/* Subtle atmospheric gradient in background */}
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{
              background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <span className="t-label">Active Registry Volume</span>
              <span className="badge badge-accent">Live Snapshot</span>
            </div>

            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className="num text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--text)]">
                {total.toLocaleString()}
              </span>
              <span className="text-[14px] font-medium text-[var(--text-3)]">
                total records ingested
              </span>
            </div>

            <p className="text-[13px] text-[var(--text-2)] mt-1.5 max-w-xl">
              Normalized real estate registers across Dubai and UAE master developments, deduplicated by unified owner and unit grain.
            </p>

            {/* Segmented Proportional Composition Bar */}
            <div className="mt-6">
              <div
                className="h-3 w-full rounded-full overflow-hidden flex bg-[var(--surface-3)] p-0.5"
                role="img"
                aria-label={`Valid ${validPct}%, Duplicate ${dupPct}%, Incomplete ${incompletePct}%, Error ${errorPct}%`}
              >
                {valid > 0 && (
                  <div
                    style={{ width: `${validPct}%` }}
                    className="h-full rounded-l-full bg-[var(--ok)] transition-all duration-700"
                    title={`Valid: ${valid.toLocaleString()} (${validPct}%)`}
                  />
                )}
                {dup > 0 && (
                  <div
                    style={{ width: `${dupPct}%` }}
                    className="h-full bg-[var(--dup)] transition-all duration-700"
                    title={`Duplicate: ${dup.toLocaleString()} (${dupPct}%)`}
                  />
                )}
                {incomplete > 0 && (
                  <div
                    style={{ width: `${incompletePct}%` }}
                    className="h-full bg-[var(--warn)] transition-all duration-700"
                    title={`Incomplete: ${incomplete.toLocaleString()} (${incompletePct}%)`}
                  />
                )}
                {errors > 0 && (
                  <div
                    style={{ width: `${errorPct}%` }}
                    className="h-full rounded-r-full bg-[var(--bad)] transition-all duration-700"
                    title={`Errors: ${errors.toLocaleString()} (${errorPct}%)`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 4 Signal Modules in Asymmetrical Hierarchy */}
          <div className="relative z-10 mt-7 pt-5 border-t border-[var(--edge)] grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]">
                <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
                <span>Usable</span>
              </div>
              <div className="num text-xl font-bold text-[var(--text)] mt-1">
                {valid.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--ok)] font-medium mt-0.5">
                {validPct}% · Verified ready
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]">
                <span className="w-2 h-2 rounded-full bg-[var(--dup)]" />
                <span>Duplicate</span>
              </div>
              <div className="num text-xl font-bold text-[var(--text)] mt-1">
                {dup.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--dup)] font-medium mt-0.5">
                {dupPct}% · Cross-matched
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]">
                <span className="w-2 h-2 rounded-full bg-[var(--warn)]" />
                <span>Incomplete</span>
              </div>
              <div className="num text-xl font-bold text-[var(--text)] mt-1">
                {incomplete.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--warn)] font-medium mt-0.5">
                {incompletePct}% · Needs phone
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]">
                <span className="w-2 h-2 rounded-full bg-[var(--bad)]" />
                <span>Errors</span>
              </div>
              <div className="num text-xl font-bold text-[var(--text)] mt-1">
                {errors.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--bad)] font-medium mt-0.5">
                {errorPct}% · Failed validation
              </div>
            </div>
          </div>
        </div>

        {/* 4-column Supporting Module: Validation Health & Operational Assurance */}
        <div className="lg:col-span-4 panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="t-label">Validation Health</span>
              <ShieldCheck className="w-4 h-4 text-[var(--ok)]" />
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="num text-4xl sm:text-5xl font-extrabold text-[var(--ok)]">
                {Number(health).toFixed(1)}%
              </span>
              <span className="text-[12px] text-[var(--text-3)] font-medium">
                compliance rate
              </span>
            </div>

            <p className="text-[12.5px] text-[var(--text-2)] mt-2 leading-relaxed">
              Rows pass strict verification including international phone formatting, unit parsing, and developer canonicalization.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-[var(--edge)] space-y-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">Phone Normalization</span>
              <span className="badge badge-ok">E.164 Verified</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">Canonical Builders</span>
              <span className="badge badge-neutral">Resolved</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">PDPL Privacy Erasure</span>
              <span className="badge badge-ok">Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECONDARY BENTO MODULES: Holdings Distribution & Operational History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 7-column Community & Spatial Concentration */}
        <div className="lg:col-span-7 panel flex flex-col">
          <div className="p-5 border-b border-[var(--edge)] flex items-center justify-between">
            <div>
              <span className="t-label">Geographic Distribution</span>
              <h2 className="text-[15px] font-semibold text-[var(--text)] mt-0.5">
                Top Holdings by Community
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('records')}
              className="btn-ghost h-7 px-2 text-[12px] text-[var(--accent)]"
            >
              Filter in Records →
            </button>
          </div>

          <div className="flex-1 p-5">
            <RegisterComposition stats={stats} />
          </div>
        </div>

        {/* 5-column Ingestion Activity & Pipeline Overview */}
        <div className="lg:col-span-5 panel flex flex-col">
          <div className="p-5 border-b border-[var(--edge)] flex items-center justify-between">
            <div>
              <span className="t-label">Pipeline Activity</span>
              <h2 className="text-[15px] font-semibold text-[var(--text)] mt-0.5">
                Recent Ingestion Runs
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('jobs')}
              className="btn-ghost h-7 px-2 text-[12px] gap-1 text-[var(--accent)]"
            >
              All Runs <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 p-5 flex flex-col justify-between">
            {runs.length ? (
              <ul className="divide-y divide-[var(--edge)]">
                {runs.map((job) => {
                  const tone = TONES[job.status] || 'neutral';
                  return (
                    <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                      <button
                        onClick={() => {
                          setSelectedJobId?.(job.id);
                          setActiveTab('jobs');
                        }}
                        className="w-full flex items-center justify-between gap-3 text-left group cursor-pointer"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <FileSpreadsheet className="w-4 h-4 text-[var(--text-3)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
                              {job.filename || `Job #${job.id}`}
                            </div>
                            <div className="text-[11px] text-[var(--text-3)] mt-0.5 flex items-center gap-2">
                              <span className="num">{(job.total_rows || 0).toLocaleString()} rows</span>
                              <span>·</span>
                              <span className="num">Batch {job.batch_size || 500}</span>
                            </div>
                          </div>
                        </div>

                        <span className={`badge badge-${tone} shrink-0`}>
                          {humanize(job.status)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-12 text-center text-[13px] text-[var(--text-3)]">
                No ingestion runs on record yet.
              </div>
            )}

            {/* Quick Engine Telemetry Strip */}
            <div className="mt-5 pt-4 border-t border-[var(--edge)] grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10.5px] text-[var(--text-3)] uppercase font-semibold">
                  Registers
                </div>
                <div className="num text-base font-bold text-[var(--text)] mt-0.5">
                  {(stats.total_files || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] text-[var(--text-3)] uppercase font-semibold">
                  Total Runs
                </div>
                <div className="num text-base font-bold text-[var(--text)] mt-0.5">
                  {(stats.total_jobs || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] text-[var(--text-3)] uppercase font-semibold">
                  Engine
                </div>
                <div className="text-base font-bold text-[var(--ok)] mt-0.5 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
                  <span>Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}