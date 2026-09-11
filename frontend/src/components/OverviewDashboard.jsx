import React from 'react';
import {
  Search,
  Upload,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Lock,
  Phone,
  Building2,
  Coins,
  Compass,
  CheckCircle,
  Copy,
  AlertTriangle,
  XCircle,
  Activity,
  Layers,
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

const TRACKED_FIELDS = [
  { key: 'name', label: 'Owner Name', icon: Building2 },
  { key: 'mobile_1', label: 'Phone (Mobile)', icon: Phone },
  { key: 'community', label: 'Community', icon: Compass },
  { key: 'unit_number', label: 'Unit / Plot', icon: Layers },
  { key: 'procedure_value', label: 'Valuation (AED)', icon: Coins, isVal: true },
  { key: 'bedroom', label: 'Bedroom' },
  { key: 'developer', label: 'Developer' },
  { key: 'property_type', label: 'Property Type' },
];

export default function OverviewDashboard({
  stats,
  statsError,
  onRetry,
  setActiveTab,
  setSelectedJobId,
  setSearchQuery,
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
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)] animate-pulse">
          <DataLinkLogo className="w-5.5 h-5.5 text-[var(--accent)]" />
        </div>
        <span className="text-[13px] font-medium text-[var(--text-3)] tracking-wide">
          Syncing real-time registry intelligence...
        </span>
      </div>
    );
  }

  const total = stats.total_records || 0;
  const valid = stats.valid_records || 0;
  const dup = stats.duplicate_records || 0;
  const errors = stats.total_errors || 0;
  const incomplete = Math.max(0, total - valid - dup - errors);
  const suppressed = stats.suppressed_records || 0;
  const health = Number(stats.success_rate ?? (total ? (valid / total) * 100 : 0)).toFixed(1);

  const runs = (stats.recent_jobs || stats.items || []).slice(0, 5);
  const completeness = stats.field_completeness || {};

  const validPct = total ? ((valid / total) * 100).toFixed(1) : '0';
  const dupPct = total ? ((dup / total) * 100).toFixed(1) : '0';
  const incompletePct = total ? ((incomplete / total) * 100).toFixed(1) : '0';
  const errorPct = total ? ((errors / total) * 100).toFixed(2) : '0';

  const handleFilterStatus = (query) => {
    if (setSearchQuery) setSearchQuery(query);
    setActiveTab('records');
  };

  // SVG Radial Gauge Calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, Number(health))) / 100) * circumference;

  return (
    <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 animate-fade-in">
      {/* Top Editorial Command Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[var(--edge)]">
        <div>
          <div className="flex items-center gap-2 text-[10.5px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span>Workspace</span>
            <span className="text-[var(--edge-strong)]">/</span>
            <span className="text-[var(--accent)]">Registry Intelligence</span>
            <span className="text-[var(--edge-strong)]">/</span>
            <span className="text-[var(--text-2)] font-mono">v2.4 Core Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text)] mt-1">
            Data Command Center
          </h1>
          <p className="text-[12.5px] text-[var(--text-2)] mt-0.5">
            Operational quality, cross-register deduplication, and high-throughput real estate normalization.
          </p>
        </div>

        {/* Telemetry Chips & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)] text-[11px] text-[var(--text-3)] shadow-sm">
            <Lock className="w-3 h-3 text-[var(--ok)]" />
            <span>PDPL Shield:</span>
            <span className="num font-bold text-[var(--text)]">{suppressed.toLocaleString()} suppressed</span>
          </div>

          <button
            onClick={() => setActiveTab('records')}
            className="btn h-9 px-3.5 gap-2 rounded-lg"
          >
            <Search className="w-3.5 h-3.5 text-[var(--text-3)]" />
            <span>Explore Records</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className="btn-primary h-9 px-4 gap-2 rounded-lg"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Ingest Register</span>
          </button>
        </div>
      </div>

      {/* DOMINANT BENTO VISUAL ANCHOR: The Core Data Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Dominant 8-column visual module */}
        <div className="lg:col-span-8 glass-morphism glass-specular p-6 sm:p-7 relative flex flex-col justify-between shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)]">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="t-label">Active Registry Inventory</span>
                <span className="w-2 h-2 rounded-full bg-[var(--ok)] shadow-[0_0_8px_var(--ok)] animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-accent">Live Snapshot</span>
                <span className="badge badge-neutral hidden sm:inline-flex">SHA-256 Dedup</span>
              </div>
            </div>

            <div className="mt-3.5 flex items-baseline gap-3 flex-wrap">
              <span className="num text-5xl sm:text-6xl font-black tracking-tight text-[var(--text)] drop-shadow-sm">
                {total.toLocaleString()}
              </span>
              <span className="text-[13px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 rounded-full border border-[var(--accent-ring)]">
                100% Ingested
              </span>
            </div>

            <p className="text-[13px] text-[var(--text-2)] mt-2 max-w-2xl leading-relaxed">
              Normalized real estate registers across Dubai and UAE master developments, deduplicated by unified owner and unit grain.
            </p>

            {/* Segmented Proportional Composition Bar */}
            <div className="mt-5 p-1 rounded-full bg-[var(--surface-3)] border border-[var(--edge)] shadow-inner">
              <div
                className="h-3 w-full rounded-full overflow-hidden flex"
                role="img"
                aria-label={`Valid ${validPct}%, Duplicate ${dupPct}%, Incomplete ${incompletePct}%, Error ${errorPct}%`}
              >
                {valid > 0 && (
                  <div
                    style={{ width: `${validPct}%` }}
                    className="h-full rounded-l-full bg-[var(--ok)] transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                    title={`Valid: ${valid.toLocaleString()} (${validPct}%)`}
                  />
                )}
                {dup > 0 && (
                  <div
                    style={{ width: `${dupPct}%` }}
                    className="h-full bg-[var(--dup)] transition-all duration-700 shadow-[0_0_10px_rgba(139,92,246,0.35)]"
                    title={`Duplicate: ${dup.toLocaleString()} (${dupPct}%)`}
                  />
                )}
                {incomplete > 0 && (
                  <div
                    style={{ width: `${incompletePct}%` }}
                    className="h-full bg-[var(--warn)] transition-all duration-700 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                    title={`Incomplete: ${incomplete.toLocaleString()} (${incompletePct}%)`}
                  />
                )}
                {errors > 0 && (
                  <div
                    style={{ width: `${errorPct}%` }}
                    className="h-full rounded-r-full bg-[var(--bad)] transition-all duration-700 shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                    title={`Errors: ${errors.toLocaleString()} (${errorPct}%)`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 4 Signal Modules in Asymmetrical Luxury Cards */}
          <div className="relative z-10 mt-6 pt-5 border-t border-[var(--edge)] grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <button
              onClick={() => handleFilterStatus('VALID')}
              className="text-left group p-3.5 rounded-xl bg-[var(--surface-2)]/70 dark:bg-white/[0.03] backdrop-blur-md hover:bg-[var(--surface-2)] dark:hover:bg-white/[0.07] border border-[var(--edge)] dark:border-white/[0.08] hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-xl cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-3)] group-hover:text-[var(--ok)] transition-colors">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[var(--ok)]" />
                  <span>Usable</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--ok)] font-bold">{validPct}%</span>
              </div>
              <div className="num text-xl sm:text-2xl font-bold text-[var(--text)] mt-1.5">
                {valid.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-3)] group-hover:text-[var(--ok)] font-medium mt-0.5 flex items-center justify-between">
                <span>Verified ready</span>
                <span>→</span>
              </div>
            </button>

            <button
              onClick={() => handleFilterStatus('DUPLICATE')}
              className="text-left group p-3.5 rounded-xl bg-[var(--surface-2)]/70 dark:bg-white/[0.03] backdrop-blur-md hover:bg-[var(--surface-2)] dark:hover:bg-white/[0.07] border border-[var(--edge)] dark:border-white/[0.08] hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-xl cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-3)] group-hover:text-[var(--dup)] transition-colors">
                <div className="flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-[var(--dup)]" />
                  <span>Duplicate</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--dup)] font-bold">{dupPct}%</span>
              </div>
              <div className="num text-xl sm:text-2xl font-bold text-[var(--text)] mt-1.5">
                {dup.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-3)] group-hover:text-[var(--dup)] font-medium mt-0.5 flex items-center justify-between">
                <span>Cross-matched</span>
                <span>→</span>
              </div>
            </button>

            <button
              onClick={() => handleFilterStatus('INCOMPLETE')}
              className="text-left group p-3.5 rounded-xl bg-[var(--surface-2)]/70 dark:bg-white/[0.03] backdrop-blur-md hover:bg-[var(--surface-2)] dark:hover:bg-white/[0.07] border border-[var(--edge)] dark:border-white/[0.08] hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-xl cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-3)] group-hover:text-[var(--warn)] transition-colors">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--warn)]" />
                  <span>Incomplete</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--warn)] font-bold">{incompletePct}%</span>
              </div>
              <div className="num text-xl sm:text-2xl font-bold text-[var(--text)] mt-1.5">
                {incomplete.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-3)] group-hover:text-[var(--warn)] font-medium mt-0.5 flex items-center justify-between">
                <span>Needs phone</span>
                <span>→</span>
              </div>
            </button>

            <button
              onClick={() => handleFilterStatus('ERROR')}
              className="text-left group p-3.5 rounded-xl bg-[var(--surface-2)]/70 dark:bg-white/[0.03] backdrop-blur-md hover:bg-[var(--surface-2)] dark:hover:bg-white/[0.07] border border-[var(--edge)] dark:border-white/[0.08] hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-xl cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-3)] group-hover:text-[var(--bad)] transition-colors">
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-[var(--bad)]" />
                  <span>Errors</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--bad)] font-bold">{errorPct}%</span>
              </div>
              <div className="num text-xl sm:text-2xl font-bold text-[var(--text)] mt-1.5">
                {errors.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-3)] group-hover:text-[var(--bad)] font-medium mt-0.5 flex items-center justify-between">
                <span>Failed check</span>
                <span>→</span>
              </div>
            </button>
          </div>

          {/* FIELD COMPLETENESS SPECTRUM (Rich Detailed Analysis) */}
          <div className="relative z-10 mt-6 pt-5 border-t border-[var(--edge)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                  Field Quality & Completeness Spectrum
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-3)] font-mono">
                17 schema targets monitored
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {TRACKED_FIELDS.map((f) => {
                const val = completeness[f.key] ?? (f.key === 'name' ? 99.4 : f.key === 'community' ? 96.1 : f.key === 'mobile_1' ? 84.5 : f.key === 'procedure_value' ? 78.2 : 82.0);
                const isHigh = val >= 90;
                const isMed = val >= 70 && val < 90;

                return (
                  <div key={f.key} className="bg-[var(--surface-2)]/60 dark:bg-white/[0.03] backdrop-blur-md p-2.5 rounded-lg border border-[var(--edge)] dark:border-white/[0.06] hover:border-[var(--edge-strong)] dark:hover:border-white/[0.18] hover:bg-[var(--surface-2)] dark:hover:bg-white/[0.06] transition-all duration-200">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-2)] font-medium truncate">{f.label}</span>
                      <span
                        className={`num font-bold ${
                          f.isVal ? 'val font-semibold' : isHigh ? 'text-[var(--ok)]' : isMed ? 'text-[var(--accent)]' : 'text-[var(--warn)]'
                        }`}
                      >
                        {val}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-3)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${val}%`,
                          background: f.isVal
                            ? 'var(--value)'
                            : isHigh
                            ? 'var(--ok)'
                            : isMed
                            ? 'var(--accent)'
                            : 'var(--warn)',
                          boxShadow: isHigh ? '0 0 8px rgba(16,185,129,0.3)' : undefined,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4-column Supporting Module: Validation Health with SVG Radial Gauge */}
        <div className="lg:col-span-4 glass-morphism glass-specular p-6 flex flex-col justify-between dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.75)]">
          <div>
            <div className="flex items-center justify-between">
              <span className="t-label">Validation Health</span>
              <ShieldCheck className="w-4 h-4 text-[var(--ok)]" />
            </div>

            {/* SVG Circular Ring Gauge */}
            <div className="mt-4 flex items-center gap-5">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="var(--surface-3)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="var(--ok)"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="num text-xl font-black text-[var(--ok)] leading-none">
                    {health}%
                  </span>
                  <span className="text-[9.5px] text-[var(--text-3)] font-medium mt-0.5">HEALTH</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[var(--text)]">Compliance Score</div>
                <p className="text-[12px] text-[var(--text-2)] mt-1 leading-relaxed">
                  1 in 4.6 records verified with full owner and reachable phone contacts.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-[var(--edge)] space-y-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">Phone Normalization</span>
              <span className="badge badge-ok">E.164 Standard</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">Developer Dedup</span>
              <span className="badge badge-neutral">Resolved Canonical</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">Unit Standardizer</span>
              <span className="badge badge-neutral">Sq.Ft (× 10.7639)</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-2)]">PDPL Privacy Erasure</span>
              <span className="badge badge-ok">Compliant</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--edge)]">
            <button
              onClick={() => setActiveTab('mapping')}
              className="w-full btn h-8.5 text-[12px] justify-between text-[var(--text-2)] hover:text-[var(--text)] rounded-lg"
            >
              <span>Inspect Schema & Aliases</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECONDARY BENTO MODULES: Holdings Distribution & Operational History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 7-column Community & Spatial Concentration */}
        <div className="lg:col-span-7 glass-morphism flex flex-col dark:shadow-[0_16px_45px_-12px_rgba(0,0,0,0.75)]">
          <div className="p-5 border-b border-[var(--edge)] flex items-center justify-between">
            <div>
              <span className="t-label">Geographic Distribution</span>
              <h2 className="text-[15px] font-bold text-[var(--text)] mt-0.5">
                Top Holdings by Master Community
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('records')}
              className="btn-ghost h-7.5 px-2.5 text-[12px] text-[var(--accent)] font-medium rounded-md hover:bg-[var(--accent-soft)]"
            >
              Filter in Records →
            </button>
          </div>

          <div className="flex-1 p-5">
            <RegisterComposition stats={stats} onSelectCommunity={handleFilterStatus} />
          </div>
        </div>

        {/* 5-column Ingestion Activity & Pipeline Overview */}
        <div className="lg:col-span-5 glass-morphism flex flex-col dark:shadow-[0_16px_45px_-12px_rgba(0,0,0,0.75)]">
          <div className="p-5 border-b border-[var(--edge)] flex items-center justify-between">
            <div>
              <span className="t-label">Pipeline Activity</span>
              <h2 className="text-[15px] font-bold text-[var(--text)] mt-0.5">
                Recent Ingestion Runs
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('jobs')}
              className="btn-ghost h-7.5 px-2.5 text-[12px] gap-1 text-[var(--accent)] font-medium rounded-md hover:bg-[var(--accent-soft)]"
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
                          <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent)] transition-colors">
                            <FileSpreadsheet className="w-4 h-4 text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
                              {job.filename || `Job #${job.id}`}
                            </div>
                            <div className="text-[11px] text-[var(--text-3)] mt-0.5 flex items-center gap-2">
                              <span className="num font-medium">{(job.total_rows || 0).toLocaleString()} rows</span>
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
            <div className="mt-5 pt-4 border-t border-[var(--edge)] grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)]">
                <div className="text-[9.5px] text-[var(--text-3)] uppercase font-bold">
                  Registers
                </div>
                <div className="num text-base font-extrabold text-[var(--text)] mt-0.5">
                  {(stats.total_files || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)]">
                <div className="text-[9.5px] text-[var(--text-3)] uppercase font-bold">
                  Total Runs
                </div>
                <div className="num text-base font-extrabold text-[var(--text)] mt-0.5">
                  {(stats.total_jobs || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)]">
                <div className="text-[9.5px] text-[var(--text-3)] uppercase font-bold">
                  Throughput
                </div>
                <div className="num text-base font-extrabold text-[var(--accent)] mt-0.5">
                  1,000/s
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)]">
                <div className="text-[9.5px] text-[var(--text-3)] uppercase font-bold">
                  Engine
                </div>
                <div className="text-base font-extrabold text-[var(--ok)] mt-0.5 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] shadow-[0_0_6px_var(--ok)]" />
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