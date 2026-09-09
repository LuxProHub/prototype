import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Activity, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import PageHeader from './ui/PageHeader';
import { ErrorState, EmptyState, LoadingRows } from './ui/States';

export default function JobDetailsView({ selectedJobId, setSelectedJobId }) {
  const [jobs, setJobs] = useState([]);
  const [activeJobData, setActiveJobData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [errorSearch, setErrorSearch] = useState('');

  const fetchJobsList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiFetch('/api/jobs');
      if (!res.ok) {
        setListError(`The server answered ${res.status}.`);
        return;
      }
      const data = await res.json();
      const jobList = data.items || data.jobs || [];
      setJobs(jobList);
      setListError(null);
      if (jobList.length > 0 && !selectedJobId) {
        setSelectedJobId(jobList[0].id);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setListError('Could not reach the server.');
    } finally {
      setListLoading(false);
    }
  }, [selectedJobId, setSelectedJobId]);

  const fetchJobDetails = useCallback(async (jobId) => {
    try {
      const [statusRes, errorRes] = await Promise.all([
        apiFetch(`/api/jobs/${jobId}`),
        apiFetch(`/api/jobs/${jobId}/errors`),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setActiveJobData(sData);
      }
      if (errorRes.ok) {
        const eData = await errorRes.json();
        setErrors(eData.errors || []);
      }
    } catch (err) {
      console.error('Error fetching job audit details:', err);
    }
  }, []);

  useEffect(() => {
    fetchJobsList();
  }, [fetchJobsList]);

  useEffect(() => {
    if (selectedJobId) {
      fetchJobDetails(selectedJobId);
    }
  }, [selectedJobId, fetchJobDetails]);

  const filteredErrors = errors.filter((err) => {
    if (!errorSearch.trim()) return true;
    const q = errorSearch.toLowerCase();
    return (
      (err.field && err.field.toLowerCase().includes(q)) ||
      (err.reason && err.reason.toLowerCase().includes(q)) ||
      (err.error_message && err.error_message.toLowerCase().includes(q)) ||
      String(err.row_index || err.row || '').includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 h-full w-full max-w-[1520px] mx-auto flex flex-col min-h-0 overflow-hidden space-y-4 animate-fade-in">
      {/* Title Header */}
      <PageHeader
        title="Processing jobs"
        description="Batch execution history and the row-level validation errors each run produced."
      />

      {/* Main 2-Column Dashboard Panel */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 overflow-hidden">
        {/* Left Column: History Runs List */}
        <div className="lg:col-span-1 bento-card p-4 rounded-[var(--radius-lg)] flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="t-heading">
                Runs ({jobs.length})
              </span>
            </div>
            <button
              onClick={fetchJobsList}
              className="btn-ghost h-7 w-7 rounded-[var(--radius-sm)]"
              title="Refresh list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 divide-y divide-[var(--edge)] mt-1">
            {listError ? (
              <ErrorState dense error={listError} onRetry={fetchJobsList} title="Jobs could not be loaded" />
            ) : listLoading && !jobs.length ? (
              <LoadingRows rows={5} />
            ) : !jobs.length ? (
              <EmptyState dense title="No runs yet" body="Upload a register to start the first job." />
            ) : null}

            {jobs.map((job) => {
              const isSelected = selectedJobId === job.id;
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left px-2.5 py-2.5 rounded-[var(--r-sm)] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                      : 'hover:bg-[var(--row-hover)]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="num text-[12px] text-[var(--text-3)]">
                      #{job.id}
                    </span>
                    <span
                      className={`badge ${
                        job.status === 'COMPLETED'
                          ? 'badge-ok'
                          : job.status === 'COMPLETED_WITH_ERRORS'
                          ? 'badge-warn'
                          : 'badge-bad'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[var(--text)] truncate mt-0.5">
                    {job.filename}
                  </p>
                  <div className="flex justify-between t-meta num mt-1">
                    <span>Rows: {job.total_rows?.toLocaleString() || 0}</span>
                    <span className={job.error_rows > 0 ? 'text-[var(--color-bad)] font-semibold' : ''}>
                      Errors: {job.error_rows || 0}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Job Details */}
        <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden space-y-4">
          {activeJobData ? (
            <>
              {/* Summary Bento Header Card */}
              <div className="bento-card p-4 sm:p-5 rounded-[var(--radius-lg)] space-y-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
                  <div>
                    <span className="t-meta num">Run #{activeJobData.id}</span>
                    <h3 className="t-heading text-[15px]">
                      {activeJobData.filename}
                    </h3>
                  </div>
                  <span className="t-meta num">
                    batch {activeJobData.batch_size || 500}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--edge)] text-xs">
                  <div className="px-3 py-1.5 first:pl-0">
                    <span className="text-[var(--color-text-muted)] t-label block">Total rows</span>
                    <span className="text-[var(--color-text-primary)] font-bold text-sm num">
                      {activeJobData.total_rows?.toLocaleString()}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 first:pl-0">
                    <span className="text-[var(--color-ok)] t-label block">Valid</span>
                    <span className="text-[var(--color-ok)] font-bold text-sm num">
                      {activeJobData.valid_rows?.toLocaleString()}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 first:pl-0">
                    <span className="text-[var(--color-warn)] t-label block">Duplicates</span>
                    <span className="text-[var(--color-warn)] font-bold text-sm num">
                      {activeJobData.duplicate_rows?.toLocaleString()}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 first:pl-0">
                    <span className="text-[var(--color-bad)] t-label block">Errors</span>
                    <span className="text-[var(--color-bad)] font-bold text-sm num">
                      {activeJobData.error_rows?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row-Level Errors Trail Bento Card */}
              <div className="bento-card p-4 sm:p-5 rounded-[var(--radius-lg)] flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-bad)]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Row-Level Validation Error Trail ({errors.length})
                    </h3>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                      type="text"
                      value={errorSearch}
                      onChange={(e) => setErrorSearch(e.target.value)}
                      placeholder="Filter errors..."
                      className="field h-7 pl-8 pr-2 text-xs w-48 rounded-[var(--radius-sm)]"
                    />
                  </div>
                </div>

                <div className="overflow-auto flex-1 min-h-0 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-[11px] bg-[var(--color-surface-elevated)] sticky top-0 z-10">
                        <th className="p-2.5 font-semibold">BATCH</th>
                        <th className="p-2.5 font-semibold">ROW</th>
                        <th className="p-2.5 font-semibold">FIELD</th>
                        <th className="p-2.5 font-semibold">ERROR REASON</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] font-sans">
                      {filteredErrors.length > 0 ? (
                        filteredErrors.map((errItem, idx) => (
                          <tr key={idx} className="hover:bg-[var(--color-surface-elevated)]">
                            <td className="p-2.5 font-mono text-[var(--color-text-secondary)] font-semibold num">
                              {errItem.batch || 1}
                            </td>
                            <td className="p-2.5 font-mono text-[var(--color-text-secondary)] num">
                              {errItem.row_index || errItem.row}
                            </td>
                            <td className="p-2.5 font-mono text-[var(--color-bad)] font-semibold">
                              {errItem.field || 'General'}
                            </td>
                            <td className="p-2.5 text-[var(--color-text-secondary)] font-medium">
                              {errItem.reason || errItem.error_message}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            className="py-10 text-center text-[var(--color-text-muted)] font-mono text-xs"
                          >
                            {errors.length === 0
                              ? 'No row-level errors recorded for this job run.'
                              : 'No errors matching filter query.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bento-card p-8 text-center text-[var(--color-text-muted)] font-mono text-xs flex-1 flex items-center justify-center">
              Select an execution run from the left panel to inspect detailed logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
