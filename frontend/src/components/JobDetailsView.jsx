import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import Tilt3DCard from './Tilt3DCard';
import { apiFetch } from '../lib/api';

export default function JobDetailsView({ selectedJobId, setSelectedJobId }) {
  const [jobs, setJobs] = useState([]);
  const [activeJobData, setActiveJobData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJobsList();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      fetchJobDetails(selectedJobId);
    }
  }, [selectedJobId]);

  const fetchJobsList = async () => {
    try {
      const res = await apiFetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        const jobList = data.items || data.jobs || [];
        setJobs(jobList);
        if (jobList.length > 0 && !selectedJobId) {
          setSelectedJobId(jobList[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  const fetchJobDetails = async (jobId) => {
    setLoading(true);
    try {
      const [statusRes, errorRes] = await Promise.all([
        apiFetch(`/api/jobs/${jobId}`),
        apiFetch(`/api/jobs/${jobId}/errors`)
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full w-full max-w-[1450px] mx-auto flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Title Header (Fixed Top) */}
      <Tilt3DCard className="p-5 rounded-xl flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text)] tracking-tight">Processing jobs</h2>
            <p className="text-xs text-[var(--text-2)] mt-1 font-medium">
              Detailed batch execution history and row-level validation error audit logs.
            </p>
          </div>
        </div>
      </Tilt3DCard>

      {/* Main 2-Column Dashboard Panel (Fits Viewport Height) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* Left Column: History List */}
        <Tilt3DCard className="lg:col-span-1 p-4 rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text)] tracking-wide">Execution Runs</span>
            </div>
            <button onClick={fetchJobsList} className="btn p-1.5 text-[var(--text-2)] hover:text-[var(--text)]" title="Refresh list">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 mt-3">
            {jobs.map((job) => {
              const isSelected = selectedJobId === job.id;
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3.5 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--surface-2)] border border-[var(--accent-ring)]'
                      : 'bg-[var(--surface-2)] border border-[var(--edge)] hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-semibold text-[var(--accent)]">#{job.id}</span>
                    <span
                      className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase border ${
                        job.status === 'COMPLETED'
                          ? 'bg-[var(--surface-2)] text-[var(--ok)] border-emerald-300'
                          : 'bg-[var(--surface-2)] text-[var(--warn)] border-amber-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text)] font-semibold truncate mt-1.5">{job.filename}</p>
                  <div className="flex justify-between text-[10px] text-[var(--text-3)] font-mono mt-2 pt-2 border-t border-[var(--edge)]">
                    <span>Rows: {job.total_rows?.toLocaleString() || 0}</span>
                    <span className="text-[var(--bad)] font-semibold">Errors: {job.error_rows || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Tilt3DCard>

        {/* Right Column: Selected Job Details */}
        <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden space-y-4">
          {activeJobData ? (
            <>
              {/* Summary Card */}
              <Tilt3DCard className="p-5 rounded-xl space-y-3 flex-shrink-0">
                <div className="flex justify-between items-center border-b border-[var(--edge)] pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-[var(--accent)] font-semibold uppercase">Audit Scope #{activeJobData.id}</span>
                    <h3 className="text-base font-semibold text-[var(--text)]">{activeJobData.filename}</h3>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-3)] font-semibold">Batch Size: {activeJobData.batch_size}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)]">
                    <span className="text-[var(--text-3)] text-[10px] block font-semibold">TOTAL ROWS</span>
                    <span className="text-[var(--text)] font-semibold text-sm">{activeJobData.total_rows?.toLocaleString()}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-emerald-300/80">
                    <span className="text-[var(--ok)] text-[10px] block font-semibold">VALID ROWS</span>
                    <span className="text-[var(--ok)] font-semibold text-sm">{activeJobData.valid_rows?.toLocaleString()}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-amber-300/80">
                    <span className="text-[var(--warn)] text-[10px] block font-semibold">DUPLICATES</span>
                    <span className="text-[var(--warn)] font-semibold text-sm">{activeJobData.duplicate_rows?.toLocaleString()}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-rose-300/80">
                    <span className="text-[var(--bad)] text-[10px] block font-semibold">ERRORS LOGGED</span>
                    <span className="text-[var(--bad)] font-semibold text-sm">{activeJobData.error_rows?.toLocaleString()}</span>
                  </div>
                </div>
              </Tilt3DCard>

              {/* Row Errors Table */}
              <Tilt3DCard className="p-5 rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
                <div className="flex items-center space-x-2 border-b border-[var(--edge)] pb-3 flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-[var(--bad)]" />
                  <h3 className="text-sm font-semibold text-[var(--text)]">Row-Level Error Trail ({errors.length})</h3>
                </div>

                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[var(--edge)] text-[var(--text-3)] text-[11px] bg-[var(--surface-2)] sticky top-0 z-10">
                        <th className="p-2.5 font-semibold">BATCH</th>
                        <th className="p-2.5 font-semibold">ROW INDEX</th>
                        <th className="p-2.5 font-semibold">FIELD</th>
                        <th className="p-2.5 font-semibold">ERROR REASON</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--edge)] font-sans">
                      {errors.length > 0 ? (
                        errors.map((errItem, idx) => (
                          <tr key={idx} className="hover:bg-slate-100/80">
                            <td className="p-2.5 font-mono text-[var(--text-2)] font-semibold">{errItem.batch || 1}</td>
                            <td className="p-2.5 font-mono text-[var(--text-2)]">{errItem.row_index || errItem.row}</td>
                            <td className="p-2.5 font-mono text-[var(--bad)] font-semibold">{errItem.field || 'General'}</td>
                            <td className="p-2.5 text-[var(--text-2)] font-medium">{errItem.reason || errItem.error_message}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="py-10 text-center text-[var(--text-3)] font-mono text-xs">
                            No row-level errors recorded for this job run.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Tilt3DCard>
            </>
          ) : (
            <Tilt3DCard className="p-8 text-center text-[var(--text-3)] font-mono text-xs flex-1 flex items-center justify-center">
              Select an execution run from the left history panel to view detailed audit logs.
            </Tilt3DCard>
          )}
        </div>
      </div>
    </div>
  );
}
