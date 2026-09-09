import { useCallback, useEffect, useState } from 'react';
import { PhoneCall, CalendarClock, RefreshCw, Inbox } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { apiFetch } from '../lib/api';

/**
 * The morning call list: who to ring, soonest first.
 *
 * The one question a sales desk asks at the start of a day. Served by
 * ix_leads_queue (owner, stage, next_action_at) against the leads table, which
 * only holds records someone actually worked -- so it stays fast without any of
 * the machinery the 20M-row records table needs.
 */

const STAGE_STYLE = {
  NEW: 'text-[var(--text-2)]',
  CONTACTED: 'text-[var(--accent)]',
  INTERESTED: 'text-[var(--ok)]',
  NEGOTIATING: 'text-[var(--warn)]',
  WON: 'text-[var(--ok)]',
  LOST: 'text-[var(--text-3)]',
  DO_NOT_CONTACT: 'text-[var(--bad)]',
};

function due(iso) {
  if (!iso) return { label: 'No action scheduled', overdue: false };
  const d = new Date(iso);
  const overdue = d < new Date();
  return {
    label: d.toLocaleString(undefined, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
    overdue,
  };
}

export default function CallQueue() {
  const [leads, setLeads] = useState([]);
  const [records, setRecords] = useState({});
  const [onlyDue, setOnlyDue] = useState(true);
  const [mine, setMine] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ open_only: 'true' });
      if (onlyDue) params.set('due', 'true');
      if (mine) params.set('mine', 'true');
      const res = await apiFetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error('Could not load the queue.');
      const rows = await res.json();
      setLeads(rows);

      // The lead row carries state, not the person. Names and numbers come
      // from the record it points at -- and a detached lead (reprocessed, not
      // yet relinked) simply has no record to fetch, which is why this is
      // per-row and tolerant rather than a join.
      const attached = rows.filter((l) => l.record_id);
      const fetched = await Promise.all(attached.map(async (l) => {
        try {
          const r = await apiFetch(`/api/records/${l.record_id}`);
          return r.ok ? [l.record_id, await r.json()] : null;
        } catch {
          return null;
        }
      }));
      setRecords(Object.fromEntries(fetched.filter(Boolean)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onlyDue, mine]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <PageHeader
        title="Call queue"
        description="Open leads with an action due, soonest first."
        actions={
          <>
          <button
            onClick={() => setMine((v) => !v)}
            aria-pressed={mine}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              mine ? 'btn-primary' : 'btn text-[var(--text-2)]'}`}
          >
            Mine
          </button>
          <button
            onClick={() => setOnlyDue((v) => !v)}
            aria-pressed={onlyDue}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              onlyDue ? 'btn-primary' : 'btn text-[var(--text-2)]'}`}
          >
            Due only
          </button>
          <button
            onClick={load}
            aria-label="Refresh queue"
            className="btn p-2 text-[var(--text-2)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          </>
        }
      />

      {error && (
        <p role="alert" className="text-xs font-semibold text-[var(--bad)]">{error}</p>
      )}

      {!loading && !leads.length && !error && (
        // An empty queue is the good outcome, not a failure. Say so.
        <div className="panel rounded-lg p-10 text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-[var(--text-3)]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--text-2)]">
            {mine || onlyDue ? 'Nothing due' : 'The queue is empty'}
          </p>
          <p className="text-xs text-[var(--text-3)]">
            {mine || onlyDue
              ? 'Leads added without an owner or a date are not in this view.'
              : 'Select records in Records and add them to the queue to start one.'}
          </p>
          {(mine || onlyDue) && (
            // Without this the default view is a dead end: someone who has just
            // queued a batch with no owner and no date arrives here, is told
            // nothing is due, and has no way to see what they added.
            <button
              onClick={() => { setMine(false); setOnlyDue(false); }}
              className="btn h-8 px-3 text-[12px] mt-1"
            >
              Show all open leads
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {leads.map((lead) => {
          const record = records[lead.record_id];
          const when = due(lead.next_action_at);
          return (
            <li
              key={lead.id}
              className="panel rounded-lg p-4 flex flex-wrap items-center gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[var(--text)] truncate">
                  {record?.name || (
                    <span className="text-[var(--text-3)] font-semibold">
                      Record unavailable
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-3)] truncate">
                  {record
                    ? [record.community, record.building_cluster, record.unit_number]
                        .filter(Boolean).join(' · ')
                    : 'Detached from its record — pending relink after a reprocess.'}
                </div>
              </div>

              <span className={`text-[10px] font-mono font-semibold ${
                STAGE_STYLE[lead.stage] || 'text-[var(--text-2)]'}`}>
                {lead.stage.replace(/_/g, ' ')}
              </span>

              <span className={`text-xs font-semibold flex items-center gap-1 ${
                when.overdue ? 'text-[var(--bad)]' : 'text-[var(--text-2)]'}`}>
                <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                {when.label}
              </span>

              {record?.mobile_1 && (
                // tel: rather than a copy button — on a phone or a softphone
                // this dials, and the browser already knows how.
                <a
                  href={`tel:${record.mobile_1}`}
                  className="btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
                  {record.mobile_1}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
