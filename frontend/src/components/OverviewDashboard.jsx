import React from 'react';
import {
  Database, 
  FileCheck2, 
  TrendingUp, 
  Copy, 
  Upload, 
  Search, 
  ArrowRight,
  PieChart,
  Activity,
  Box
} from 'lucide-react';
import Tilt3DCard from './Tilt3DCard';
import DataLinkLogo from './DataLinkLogo';
import { ErrorState } from './ui/States';
import PageHeader from './ui/PageHeader';

export default function OverviewDashboard({ stats, statsError, onRetry, setActiveTab, setSelectedJobId }) {

  if (statsError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ErrorState error={statsError} onRetry={onRetry} title="Overview could not be loaded" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-10 sm:p-20 text-center text-[var(--text-3)] font-mono text-xs flex flex-col items-center justify-center space-y-5 h-full">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[var(--surface)] p-3 border border-[var(--accent-ring)] flex items-center justify-center animate-pulse">
          <DataLinkLogo className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <p className="text-[var(--text)] font-medium text-sm">Connecting to the local database</p>
        <p className="text-[var(--text-3)] text-xs">Loading pipeline stats and register totals</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Clean Records',
      value: stats.total_records.toLocaleString(),
      subtitle: `${stats.valid_records.toLocaleString()} Validated Rows`,
      icon: Database,
      badge: 'Local PostgreSQL',
      iconBg: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-ring)]',
    },
    {
      title: 'Pipeline Success Rate',
      value: `${stats.success_rate}%`,
      subtitle: `${stats.total_errors} Flagged Warnings`,
      icon: TrendingUp,
      badge: 'Real Verification',
      iconBg: 'bg-[var(--ok-soft)] text-[var(--ok)] border-[var(--ok)]/30',
    },
    {
      title: 'Duplicates Filtered',
      value: stats.duplicate_records.toLocaleString(),
      subtitle: 'Dedup Rules Applied',
      icon: Copy,
      badge: 'In-Engine',
      iconBg: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30',
    },
    {
      title: 'Source Files Ingested',
      value: stats.total_files.toLocaleString(),
      subtitle: `${stats.total_jobs} Execution Runs`,
      icon: FileCheck2,
      badge: 'Multi-Format',
      iconBg: 'bg-[var(--dup-soft)] text-[var(--dup)] border-[var(--dup)]/30',
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 relative z-10 max-w-7xl mx-auto">
      <PageHeader
        title="Overview"
        description="Ingestion, cleaning and deduplication across every register, on the local PostgreSQL database."
        actions={
          <>
            <button onClick={() => setActiveTab('upload')} className="btn-primary h-9 px-3 text-[13px]">
              <Upload className="w-4 h-4" />
              <span>Upload registers</span>
            </button>
            <button onClick={() => setActiveTab('records')} className="btn h-9 px-3 text-[13px]">
              <Search className="w-4 h-4 text-[var(--accent)]" />
              <span>Explore records</span>
            </button>
          </>
        }
      />

      {/* Neumorphic KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Tilt3DCard key={idx} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-2)] tracking-wide">{card.title}</span>
                <span className="badge badge-neutral">{card.badge}</span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <h3 className="text-2xl sm:text-3xl font-semibold text-[var(--text)] tracking-tight">{card.value}</h3>
                <div className={`p-2.5 sm:p-3 rounded-lg border ${card.iconBg}`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-3)] font-mono pt-1 border-t border-[var(--edge)]">{card.subtitle}</p>
            </Tilt3DCard>
          );
        })}
      </div>

      {/* Middle Section: Community Breakdown & Ingestion Audit Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Top Communities Distribution Card */}
        <Tilt3DCard className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
            <div className="flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--text)] tracking-wide">Community Distribution</h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--ok)] font-semibold bg-[var(--surface)] px-2 py-0.5 rounded-full border border-[var(--ok)]/30 field">REAL DATA</span>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {stats.community_distribution && stats.community_distribution.length > 0 ? (
              stats.community_distribution.map((item, index) => {
                const maxCount = stats.community_distribution[0]?.count || 1;
                const percentage = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-[var(--text)] truncate max-w-[180px] font-semibold">{item.name}</span>
                      <span className="font-mono text-[var(--accent)] font-semibold">{item.count.toLocaleString()} records</span>
                    </div>
                    <div className="h-2.5 w-full bg-[var(--surface)] rounded-full overflow-hidden p-0.5 border border-[var(--edge)] field">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center border border-dashed border-[var(--edge)] rounded-lg space-y-2 bg-[var(--surface)]">
                <Box className="w-8 h-8 text-[var(--text-3)] mx-auto" />
                <p className="text-xs text-[var(--text-2)] font-medium">No records ingested yet</p>
                <p className="text-[11px] text-[var(--text-3)] font-mono">Upload an Excel register to view real community breakdown.</p>
              </div>
            )}
          </div>
        </Tilt3DCard>

        {/* Recent Ingestion Runs Table */}
        <Tilt3DCard className="lg:col-span-2 p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[var(--ok)]" />
              <h3 className="text-sm font-semibold text-[var(--text)] tracking-wide">Ingestion Runs Audit Pipeline</h3>
            </div>
            <button
              onClick={() => setActiveTab('jobs')}
              className="text-xs text-[var(--accent)] hover:underline font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <span>View History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--edge)] text-[var(--text-3)] font-mono text-[11px]">
                  <th className="pb-3 font-semibold">JOB ID</th>
                  <th className="pb-3 font-semibold">SOURCE FILE</th>
                  <th className="pb-3 font-semibold">STATUS</th>
                  <th className="pb-3 font-semibold text-right">TOTAL ROWS</th>
                  <th className="pb-3 font-semibold text-right">ERRORS</th>
                  <th className="pb-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--edge)] font-sans">
                {(stats.recent_jobs || stats.items) && (stats.recent_jobs || stats.items).length > 0 ? (
                  (stats.recent_jobs || stats.items).map((job) => (
                    <tr key={job.id} className="hover:bg-[var(--accent-soft)] transition-colors group">
                      <td className="py-3 font-semibold text-[var(--accent)] font-mono">#{job.id}</td>
                      <td className="py-3 text-[var(--text)] font-medium font-sans truncate max-w-[160px]">{job.filename}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider border ${
                            job.status === 'COMPLETED'
                              ? 'bg-[var(--ok-soft)] text-[var(--ok)] border-[var(--ok)]/30'
                              : job.status === 'COMPLETED_WITH_ERRORS'
                              ? 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30'
                              : job.status === 'FAILED'
                              ? 'bg-[var(--bad-soft)] text-[var(--bad)] border-[var(--bad)]/30'
                              : 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-ring)]'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-[var(--text-2)] font-mono">{job.total_rows?.toLocaleString() || 0}</td>
                      <td className="py-3 text-right text-[var(--bad)] font-semibold font-mono">{job.error_rows || 0}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setActiveTab('jobs');
                          }}
                          className="text-[11px] text-[var(--accent)] hover:underline font-semibold cursor-pointer transition-colors"
                        >
                          Audit Run
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[var(--text-3)] font-mono">
                      No ingestion runs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Tilt3DCard>
      </div>
    </div>
  );
}
