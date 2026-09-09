import React, { useEffect, useRef, useState } from 'react';
import { Activity, Terminal, RefreshCw, ArrowRight } from 'lucide-react';
import Tilt3DCard from './Tilt3DCard';
import { apiFetch } from '../lib/api';
import { ErrorState } from './ui/States';

export default function LiveProcessingTracker({ jobId, onJobCompleted, setActiveTab }) {
  const [jobState, setJobState] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pollError, setPollError] = useState(null);
  // Polling retries on its own, so one blip is not worth alarming about. Only
  // a sustained outage is, otherwise the page spins forever saying nothing.
  const failures = useRef(0);

  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/jobs/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          failures.current = 0;
          setPollError(null);
          setJobState(data);

          setLogs((prev) => {
            const timeStr = new Date().toLocaleTimeString();
            const newLog = `[${timeStr}] Batch ${data.current_batch}/${data.total_batches} | Status: ${data.status} | Processed ${data.processed_rows}/${data.total_rows} rows`;
            if (prev.length === 0 || prev[prev.length - 1] !== newLog) {
              return [...prev.slice(-15), newLog];
            }
            return prev;
          });

          if (data.status === 'COMPLETED' || data.status === 'COMPLETED_WITH_ERRORS' || data.status === 'FAILED') {
            clearInterval(pollInterval);
            fetchErrors();
            if (onJobCompleted) onJobCompleted();
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        failures.current += 1;
        if (failures.current >= 5) {
          setPollError('Lost contact with the server.');
        }
      }
    }, 700);

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const fetchErrors = async () => {
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/errors`);
      if (res.ok) {
        const data = await res.json();
        setErrorLogs(data.errors || []);
      }
    } catch (err) {
      console.error('Error fetching job error log:', err);
    }
  };

  if (pollError && !jobState) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorState
          title={`Job #${jobId} could not be reached`}
          error={pollError}
          onRetry={() => { failures.current = 0; setPollError(null); }}
        />
      </div>
    );
  }

  if (!jobState) {
    return (
      <Tilt3DCard className="p-8 max-w-4xl mx-auto text-center space-y-3">
        <RefreshCw className="w-6 h-6 text-[var(--accent)] animate-spin mx-auto" />
        <p className="text-xs text-[var(--text-2)] font-mono">Connecting to Python batch execution engine for Job #{jobId}...</p>
      </Tilt3DCard>
    );
  }

  const steps = ['UPLOADED', 'READING', 'PROCESSING', 'VALIDATING', 'SAVING', 'COMPLETED'];

  const getStepStatus = (stepName) => {
    const order = ['UPLOADED', 'READING', 'PROCESSING', 'VALIDATING', 'SAVING', 'COMPLETED', 'COMPLETED_WITH_ERRORS'];
    const currentIndex = order.indexOf(jobState.status);
    const stepIndex = order.indexOf(stepName);

    if (jobState.status.startsWith('COMPLETED')) return 'completed';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="badge badge-accent num">Run #{jobId}</span>
          <h2 className="text-xl font-semibold text-[var(--text)] tracking-tight mt-2">{jobState.filename}</h2>
        </div>
        <span
          className={`px-3 py-1 text-xs font-semibold font-mono rounded-full border ${
            jobState.status === 'COMPLETED'
              ? 'bg-[var(--surface-2)] text-[var(--ok)] border-[var(--ok)]/30'
              : jobState.status === 'COMPLETED_WITH_ERRORS'
              ? 'bg-[var(--surface-2)] text-[var(--warn)] border-[var(--warn)]/30'
              : jobState.status === 'FAILED'
              ? 'bg-[var(--surface-2)] text-[var(--bad)] border-[var(--bad)]/30'
              : 'bg-[var(--surface-2)] text-[var(--accent)] border-[var(--accent-ring)]'
          }`}
        >
          {jobState.status}
        </span>
      </div>

      {/* Engine Diagnostic Callout Banner */}
      {jobState.message && (
        <div className={`p-4 rounded-lg border text-xs font-mono space-y-1 bg-[var(--surface-2)] ${
          jobState.status === 'FAILED' ? 'border-[var(--bad)]/30 text-[var(--bad)]' : 'border-[var(--accent-ring)] text-[var(--accent)]'
            }`}>
          <span className="font-semibold block uppercase text-[10px] tracking-wider">
            {jobState.status === 'FAILED' ? '⚠ Engine Execution Diagnostic Error:' : 'ℹ Engine Processing Notice:'}
          </span>
          <p className="leading-relaxed font-semibold">{jobState.message}</p>
        </div>
      )}

      {/* Pipeline Stepper */}
      <Tilt3DCard className="p-6">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-[var(--edge-strong)] -z-10 transform -translate-y-1/2"></div>

          {steps.map((step, idx) => {
            const status = getStepStatus(step);
            return (
              <div key={idx} className="flex flex-col items-center space-y-2 bg-[var(--surface-2)] px-2.5 py-1 rounded-xl border border-[var(--edge)]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    status === 'completed'
                      ? 'bg-[var(--ok)] text-white'
                      : status === 'active'
                      ? 'bg-[var(--accent)] text-white animate-pulse'
                      : 'bg-[var(--edge-strong)] text-[var(--text-2)]'
                  }`}
                >
                  {status === 'completed' ? '✓' : idx + 1}
                </div>
                <span className={`text-[10px] font-mono uppercase font-semibold ${
                  status === 'completed' ? 'text-[var(--ok)]' : status === 'active' ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'
                    }`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </Tilt3DCard>

      {/* Progress Bar & Key Metrics */}
      <Tilt3DCard className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono font-semibold">
            <span className="text-[var(--text)]">BATCH PROGRESS: Batch {jobState.current_batch} / {jobState.total_batches}</span>
            <span className="text-[var(--accent)]">{jobState.progress_pct}%</span>
          </div>
          <div className="h-3 w-full bg-[var(--surface-2)] rounded-full overflow-hidden p-0.5 border border-[var(--edge)]">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
              style={{ width: `${jobState.progress_pct}%` }}
            ></div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)]">
            <span className="text-[10px] text-[var(--text-3)] block font-semibold">TOTAL PROCESSED</span>
            <span className="text-sm font-semibold text-[var(--text)]">{jobState.processed_rows} / {jobState.total_rows}</span>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--ok)]/30">
            <span className="text-[10px] text-[var(--ok)] block font-semibold">VALID RECORDS</span>
            <span className="text-sm font-semibold text-[var(--ok)]">{jobState.valid_rows}</span>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--warn)]/30">
            <span className="text-[10px] text-[var(--warn)] block font-semibold">DUPLICATES FLAGGED</span>
            <span className="text-sm font-semibold text-[var(--warn)]">{jobState.duplicate_rows}</span>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--bad)]/30">
            <span className="text-[10px] text-[var(--bad)] block font-semibold">VALIDATION ERRORS</span>
            <span className="text-sm font-semibold text-[var(--bad)]">{jobState.error_rows}</span>
          </div>
        </div>
      </Tilt3DCard>

      {/* Terminal Stream */}
      <Tilt3DCard className="p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text)] font-mono">
            <Terminal className="w-4 h-4 text-[var(--accent)]" />
            <span>BATCH ENGINE TERMINAL STREAM</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-3)]">Socket Stream Sync</span>
        </div>

        <div className="field p-4 rounded-lg font-mono text-xs text-[var(--accent)] space-y-1.5 h-36 overflow-y-auto">
          {logs.map((logLine, i) => (
            <p key={i} className="leading-relaxed">{logLine}</p>
          ))}
        </div>
      </Tilt3DCard>

      {/* Next Actions */}
      {(jobState.status.startsWith('COMPLETED') || jobState.status === 'FAILED') && (
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setActiveTab('records')}
            className="btn-primary px-6 py-3 text-xs font-semibold flex items-center space-x-2"
          >
            <span>Explore Clean Processed Records</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
