import React, { useEffect, useRef, useState } from 'react';
import { Loader2, PhoneCall, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useToast } from '../lib/toast';

/**
 * Confirm putting a selection of records on the call queue.
 *
 * A preview rather than a straight-through action, because the count the
 * operator sees selected is not the count of people they will call: leads are
 * keyed by owner identity, so four units owned by one person are one call. The
 * result is reported back in the same shape the server returns it.
 *
 * Assignment and scheduling are optional and apply to newly created leads
 * only. Re-adding a record somebody else is already working must not quietly
 * take it off them -- the server enforces that; this just does not promise it.
 */
export default function AddToQueueDialog({ recordIds, users, onClose, onDone, onGoToQueue }) {
  const { notify } = useToast();
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { record_ids: recordIds };
      if (assignee) body.owner_user_id = Number(assignee);
      if (dueDate) body.next_action_at = new Date(dueDate).toISOString();

      const res = await apiFetch('/api/leads/bulk', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `The server answered ${res.status}.`);
      }
      const data = await res.json();
      setResult(data);

      const parts = [`${data.added} added to the call queue`];
      if (data.already_queued) parts.push(`${data.already_queued} already queued`);
      if (data.opted_out) parts.push(`${data.opted_out} opted out`);
      if (data.failed.length) parts.push(`${data.failed.length} failed`);
      notify(parts.join(' · '), { tone: data.failed.length ? 'bad' : 'ok' });

      // Keep only what genuinely failed selected, so a retry is one click and
      // the operator does not have to rebuild the whole selection.
      onDone(data.failed.map((f) => f.record_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const count = recordIds.length;

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-dialog-title"
        className="glass-raised w-full sm:max-w-md rounded-b-none sm:rounded-b-[var(--r-xl)] flex flex-col overflow-hidden animate-rise-in"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--edge)]">
          <div className="min-w-0">
            <h3 id="queue-dialog-title" className="text-[15px] font-semibold text-[var(--text)]">
              {result ? 'Added to call queue' : 'Add to call queue'}
            </h3>
            {!result && (
              <p className="text-[12px] text-[var(--text-2)] mt-0.5">
                <span className="num text-[var(--text)]">{count}</span>
                {count === 1 ? ' record selected' : ' records selected'}
              </p>
            )}
          </div>
          <button ref={closeRef} onClick={onClose} className="btn-ghost h-8 w-8 shrink-0" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3.5 space-y-3.5">
          {result ? (
            <>
              <dl className="space-y-1.5">
                <Row label="Added" value={result.added} tone="ok" />
                {result.already_queued > 0 && (
                  <Row label="Already in queue" value={result.already_queued} hint="Same owner, already being worked" />
                )}
                {result.opted_out > 0 && (
                  <Row label="Opted out" value={result.opted_out} tone="warn" hint="Marked do not contact — not added" />
                )}
                {result.failed.length > 0 && (
                  <Row label="Failed" value={result.failed.length} tone="bad" hint={result.failed[0].reason} />
                )}
              </dl>
              {result.failed.length > 0 && (
                <p className="text-[12px] text-[var(--text-3)]">
                  Records that failed are still selected, so you can try them again.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] text-[var(--text-2)]">
                Leads are one per owner, so records sharing an owner become a single
                call. Anything already queued is left exactly as it is.
              </p>

              <div>
                <label htmlFor="queue-assignee" className="block text-[12px] text-[var(--text-2)] mb-1.5">
                  Assign to <span className="text-[var(--text-3)]">(optional)</span>
                </label>
                <select
                  id="queue-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="field w-full h-9 px-2.5 text-[13px]"
                >
                  <option value="">Leave unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="queue-due" className="block text-[12px] text-[var(--text-2)] mb-1.5">
                  Next action <span className="text-[var(--text-3)]">(optional)</span>
                </label>
                <input
                  id="queue-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="field w-full h-9 px-2.5 text-[13px]"
                />
              </div>

              {error && (
                <p role="alert" className="text-[12px] text-[var(--bad)]">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--edge)] bg-[var(--surface-2)]/40">
          {result ? (
            <>
              <button onClick={onClose} className="btn h-9 px-3 text-[13px]">Close</button>
              <button onClick={onGoToQueue} className="btn-primary h-9 px-3 text-[13px]">
                <PhoneCall className="w-4 h-4" />
                View call queue
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn h-9 px-3 text-[13px]">Cancel</button>
              <button onClick={submit} disabled={busy} className="btn-primary h-9 px-3 text-[13px]">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                {busy ? 'Adding' : `Add ${count}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone, hint }) {
  const color = tone ? `var(--${tone})` : 'var(--text)';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-[var(--text-2)]">
        {label}
        {hint && <span className="block text-[11px] text-[var(--text-3)]">{hint}</span>}
      </dt>
      <dd className="num text-[15px] font-semibold shrink-0" style={{ color }}>{value}</dd>
    </div>
  );
}
