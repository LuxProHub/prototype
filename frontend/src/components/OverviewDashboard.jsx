import React from 'react';
import { Upload, Search, ArrowRight, AlertTriangle } from 'lucide-react';
import RegisterComposition from './viz/RegisterComposition';
import { ErrorState } from './ui/States';
import DataLinkLogo from './DataLinkLogo';

/**
 * Overview: four modules, three weights, nothing said twice.
 *
 * The composition hero states the register's size and shape, so there is no
 * separate "total records" tile; duplicates and incompletes are bands on the
 * hero's rail, so they get no tiles either. What remains beside it is the one
 * quality figure an operator checks first (validation), and beneath it the
 * two things that change day to day: the run log, and the pipeline's health.
 *
 * Importance is expressed as area, not as a row of equal cards.
 */
const RUN_TONE = {
  COMPLETED: 'ok',
  COMPLETED_WITH_ERRORS: 'warn',
  FAILED: 'bad',
  RUNNING: 'accent',
  PROCESSING: 'accent',
  PENDING: 'neutral',
  PAUSED: 'warn',
};

function runLabel(status) {
  return String(status || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function Fact({ label, value, hint, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[var(--edge)] last:border-b-0">
      <div className="min-w-0">
        <div className="text-[12.5px] text-[var(--text)]">{label}</div>
        {hint && <div className="t-meta mt-0.5 truncate">{hint}</div>}
      </div>
      <div
        className="num text-[15px] font-semibold shrink-0"
        style={{ color: tone ? `var(--${tone})` : 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  );
}

export default function OverviewDashboard({ stats, statsError, onRetry, setActiveTab, setSelectedJobId }) {
  if (statsError) {
    return (
      <div className="p-4 sm:p-6 max-w-[1520px] mx-auto">
        <ErrorState error={statsError} onRetry={onRetry} title="Overview could not be loaded" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="w-11 h-11 rounded-[10px] bg-[var(--accent-soft)] border border-[var(--accent-ring)] flex items-center justify-center animate-pulse">
          <DataLinkLogo className="w-6 h-6" />
        </div>
        <div className="text-[13px] font-medium text-[var(--text)]">Loading the register</div>
        <div className="t-meta">Totals, quality and recent runs</div>
      </div>
    );
  }

  const successRate = stats.success_rate ?? 0;
  const totalFiles = stats.total_files ?? 0;
  const totalJobs = stats.total_jobs ?? 0;
  const totalErrors = stats.total_errors ?? 0;
  const runs = (stats.recent_jobs || stats.items || []).slice(0, 6);
  const lastRun = runs[0];

  return (
    <div className="p-4 sm:p-5 max-w-[1520px] mx-auto space-y-4">
      {/* Title row. Context is a fact, not a slogan. */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-title">Overview</h1>
          <p className="t-meta mt-1">
            <span className="num text-[var(--text-2)]">{totalFiles.toLocaleString()}</span> registers ingested across{' '}
            <span className="num text-[var(--text-2)]">{totalJobs.toLocaleString()}</span> runs
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setActiveTab('records')} className="btn h-8 px-3 text-[12.5px]">
            <Search className="w-3.5 h-3.5 text-[var(--text-3)]" />
            <span className="hidden sm:inline">Explore records</span>
          </button>
          <button onClick={() => setActiveTab('upload')} className="btn-primary h-8 px-3 text-[12.5px]">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload registers</span>
          </button>
        </div>
      </div>

      {/* Row A: the headline. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bento-hero min-h-[24rem]">
          <RegisterComposition stats={stats} />
        </div>

        <section className="lg:col-span-4 l2 p-4 flex flex-col" aria-label="Validation">
          <div className="section-head">
            <h2 className="t-heading">Validation</h2>
            <span className="t-meta">of ingested rows</span>
          </div>

          <div className="flex-1 flex flex-col justify-center py-4">
            <div className="t-value text-[40px]" style={{ color: 'var(--ok)' }}>
              {Number(successRate).toFixed(1)}%
            </div>
            <div className="t-meta mt-2">passed every validation rule</div>

            <div className="mt-5 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--ok)] transition-[width] duration-700"
                style={{ width: `${Math.min(100, Number(successRate))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-[var(--edge)] text-[12.5px]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: totalErrors ? 'var(--warn)' : 'var(--text-3)' }} />
            <span className="text-[var(--text-2)]">
              <span className="num text-[var(--text)]">{totalErrors.toLocaleString()}</span>
              {totalErrors === 1 ? ' row flagged' : ' rows flagged'}
            </span>
            {totalErrors > 0 && (
              <button onClick={() => setActiveTab('jobs')} className="ml-auto btn-ghost h-6 px-1.5 text-[11.5px] text-[var(--accent)]">
                Review
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Row B: what changed recently, and whether the pipeline is well. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 l2 p-4" aria-label="Recent runs">
          <div className="section-head">
            <h2 className="t-heading">Recent runs</h2>
            <button
              onClick={() => setActiveTab('jobs')}
              className="t-meta hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              All runs <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {runs.length === 0 ? (
            <p className="t-body py-8 text-center">No runs yet. Upload a register to start the first one.</p>
          ) : (
            <ul className="divide-y divide-[var(--edge)]">
              {runs.map((job) => {
                const tone = RUN_TONE[job.status] || 'neutral';
                return (
                  <li key={job.id}>
                    <button
                      onClick={() => {
                        setSelectedJobId?.(job.id);
                        setActiveTab('jobs');
                      }}
                      className="w-full grid grid-cols-[3.25rem_1fr_auto] sm:grid-cols-[3.25rem_1fr_7rem_5.5rem_5rem] items-center gap-3 py-2 text-left rounded-[var(--r-sm)] hover:bg-[var(--row-hover)] transition-colors cursor-pointer"
                    >
                      <span className="num text-[12px] text-[var(--text-3)]">#{job.id}</span>
                      <span className="text-[12.5px] text-[var(--text)] truncate">{job.filename}</span>
                      <span className={`badge badge-${tone} justify-self-start`}>{runLabel(job.status)}</span>
                      <span className="hidden sm:block num text-[12px] text-[var(--text-2)] text-right">
                        {(job.total_rows || 0).toLocaleString()}
                      </span>
                      <span
                        className="hidden sm:block num text-[12px] text-right"
                        style={{ color: job.error_rows > 0 ? 'var(--bad)' : 'var(--text-3)' }}
                      >
                        {job.error_rows > 0 ? `${job.error_rows.toLocaleString()} err` : '—'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-4 l2 p-4" aria-label="Pipeline health">
          <div className="section-head">
            <h2 className="t-heading">Pipeline</h2>
            <span className="t-meta">local PostgreSQL</span>
          </div>
          <div className="mt-1">
            <Fact
              label="Last run"
              value={lastRun ? runLabel(lastRun.status) : '—'}
              hint={lastRun?.filename}
              tone={lastRun ? RUN_TONE[lastRun.status] || 'text' : undefined}
            />
            <Fact label="Registers ingested" value={totalFiles.toLocaleString()} hint="xlsx, xls and csv" />
            <Fact label="Runs" value={totalJobs.toLocaleString()} hint="batch executions to date" />
            <Fact
              label="Rows flagged"
              value={totalErrors.toLocaleString()}
              hint="across all runs"
              tone={totalErrors ? 'warn' : undefined}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
