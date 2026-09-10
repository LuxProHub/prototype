import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, ArrowRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { humanize } from '../lib/labels';
import { ErrorState, EmptyState } from './ui/States';
import PageHeader from './ui/PageHeader';

export default function LiveProcessingTracker({ jobId, onJobCompleted, setActiveTab }) {
  const [jobState, setJobState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pollError, setPollError] = useState(null);
  const failures = useRef(0);

  const fetchErrors = useCallback(async () => {
    try {
      await apiFetch(`/api/jobs/${jobId}/errors`);
    } catch (err) {
      console.error('Error fetching job error log:', err);
    }
  }, [jobId]);

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
              return [...prev.slice(-20), newLog];
            }
            return prev;
          });

          if (
            data.status === 'COMPLETED' ||
            data.status === 'COMPLETED_WITH_ERRORS' ||
            data.status === 'FAILED'
          ) {
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
  }, [jobId, fetchErrors, onJobCompleted]);

  if (pollError && !jobState) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <ErrorState
          title={`Job #${jobId} could not be reached`}
          error={pollError}
          onRetry={() => {
            failures.current = 0;
            setPollError(null);
          }}
        />
      </div>
    );
  }

  // Reached from the sidebar with nothing running. Spinning on "Run #null"
  // reads as a hang; say what this view is for instead.
  if (!jobId) {
    return (
      <div className="p-4 sm:p-6 max-w-[1520px] mx-auto">
        <EmptyState
          title="No run in progress"
          body="This view follows a register while it is processed. Start an upload and it opens here on its own."
          action={
            <button onClick={() => setActiveTab?.('upload')} className="btn h-8 px-3 text-[12px] mt-1">
              Go to Upload
            </button>
          }
        />
      </div>
    );
  }

  if (!jobState) {
    return (
      <div className="bento-card p-10 max-w-4xl mx-auto text-center space-y-3 mt-8">
        <RefreshCw className="w-6 h-6 text-[var(--accent)] animate-spin mx-auto" />
        <p className="text-xs text-[var(--text-2)] font-mono">
          Connecting to run #{jobId}
        </p>
      </div>
    );
  }

  const steps = ['UPLOADED', 'READING', 'PROCESSING', 'VALIDATING', 'SAVING', 'COMPLETED'];

  const getStepStatus = (stepName) => {
    const order = [
      'UPLOADED',
      'READING',
      'PROCESSING',
      'VALIDATING',
      'SAVING',
      'COMPLETED',
      'COMPLETED_WITH_ERRORS',
    ];
    const currentIndex = order.indexOf(jobState.status);
    const stepIndex = order.indexOf(stepName);

    if (jobState.status.startsWith('COMPLETED')) return 'completed';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Top Header */}
      <PageHeader
        title={`Run #${jobId}`}
        description={`File: ${jobState.filename || 'Register batch'}`}
        actions={
          <span
            className={`badge ${
              jobState.status === 'COMPLETED'
                ? 'badge-ok'
                : jobState.status === 'COMPLETED_WITH_ERRORS'
                ? 'badge-warn'
                : jobState.status === 'FAILED'
                ? 'badge-bad'
                : 'badge-accent'
            }`}
          >
            {humanize(jobState.status)}
          </span>
        }
      />

      {/* Engine Diagnostic Notice */}
      {jobState.message && (
        <div
          className={`p-3.5 rounded-[var(--r-md)] border text-xs font-mono space-y-1 bg-[var(--surface-2)] ${
            jobState.status === 'FAILED'
              ? 'border-[var(--bad)]/30 text-[var(--bad)]'
              : 'border-[var(--accent)]/30 text-[var(--accent)]'
          }`}
        >
          <span className="t-label block">
            {jobState.status === 'FAILED' ? '⚠ Engine Error Notice:' : 'ℹ Execution Notice:'}
          </span>
          <p className="leading-relaxed font-semibold">{jobState.message}</p>
        </div>
      )}

      {/* 6-Step Visual Processing Pipeline Stepper */}
      <div className="bento-card p-5">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-[var(--edge)] -z-0 transform -translate-y-1/2" />

          {steps.map((step, idx) => {
            const status = getStepStatus(step);
            return (
              <div
                key={idx}
                className="relative z-10 flex flex-col items-center space-y-1.5 bg-[var(--surface)] px-2 py-1 rounded-[var(--r-md)] border border-[var(--edge)]"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    status === 'completed'
                      ? 'bg-[var(--ok)] text-white'
                      : status === 'active'
                      ? 'bg-[var(--accent)] text-white animate-pulse'
                      : 'bg-[var(--surface-2)] text-[var(--text-3)]'
                  }`}
                >
                  {status === 'completed' ? '✓' : idx + 1}
                </div>
                <span
                  className={`t-label ${
                    status === 'completed'
                      ? 'text-[var(--ok)]'
                      : status === 'active'
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-3)]'
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Bar & Live Counter Cards */}
      <div className="bento-card p-5 space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono font-semibold">
            <span className="text-[var(--text)]">
              BATCH STREAM: Batch {jobState.current_batch} / {jobState.total_batches}
            </span>
            <span className="text-[var(--accent)] font-bold">{jobState.progress_pct}%</span>
          </div>
          <div className="h-2.5 w-full bg-[var(--surface-2)] rounded-full overflow-hidden p-0.5 border border-[var(--edge)]">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
              style={{ width: `${jobState.progress_pct}%` }}
            />
          </div>
        </div>

        {/* Live KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--edge)]">
            <span className="text-[10px] text-[var(--text-3)] block font-semibold">
              TOTAL PROCESSED
            </span>
            <span className="text-sm font-bold text-[var(--text)] num">
              {jobState.processed_rows} / {jobState.total_rows}
            </span>
          </div>
          <div className="p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--ok)]/30">
            <span className="text-[10px] text-[var(--ok)] block font-semibold">
              VALID RECORDS
            </span>
            <span className="text-sm font-bold text-[var(--ok)] num">
              {jobState.valid_rows}
            </span>
          </div>
          <div className="p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--warn)]/30">
            <span className="text-[10px] text-[var(--warn)] block font-semibold">
              DUPLICATES
            </span>
            <span className="text-sm font-bold text-[var(--warn)] num">
              {jobState.duplicate_rows}
            </span>
          </div>
          <div className="p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--bad)]/30">
            <span className="text-[10px] text-[var(--bad)] block font-semibold">
              VALIDATION ERRORS
            </span>
            <span className="text-sm font-bold text-[var(--bad)] num">
              {jobState.error_rows}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal Stream */}
      <div className="bento-card p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text)] font-mono">
            <Terminal className="w-4 h-4 text-[var(--accent)]" />
            <span>ENGINE EXECUTION TERMINAL STREAM</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-3)]">Live WebSocket Polling</span>
        </div>

        <div className="field p-3.5 rounded-[var(--r-md)] font-mono text-xs text-[var(--accent)] space-y-1 h-36 overflow-y-auto bg-[var(--ink)]">
          {logs.map((logLine, i) => (
            <p key={i} className="leading-relaxed font-mono">
              {logLine}
            </p>
          ))}
        </div>
      </div>

      {/* Next Action Primary Button */}
      {(jobState.status.startsWith('COMPLETED') || jobState.status === 'FAILED') && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setActiveTab('records')}
            className="btn-primary h-10 px-5 text-[12.5px] font-semibold flex items-center gap-2 shadow-md"
          >
            <span>Explore Clean Processed Records</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
