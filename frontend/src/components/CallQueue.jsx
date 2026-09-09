import React, { useCallback, useEffect, useState } from 'react';
import { PhoneCall, RefreshCw, Inbox, AlertCircle, Search, ChevronRight } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { apiFetch } from '../lib/api';
import QueuePipeline from './viz/QueuePipeline';
import SidePanel from './ui/SidePanel';
import RecordInspector from './RecordInspector';
import LeadActivityPanel from './LeadActivityPanel';
import { StatusBadge } from './ui/Badge';

const STAGE_CONFIG = {
  NEW: { label: 'Ready', tone: 'accent' },
  CONTACTED: { label: 'Calling', tone: 'accent' },
  INTERESTED: { label: 'Follow-up', tone: 'warn' },
  NEGOTIATING: { label: 'Negotiating', tone: 'warn' },
  WON: { label: 'Completed', tone: 'ok' },
  LOST: { label: 'Lost', tone: 'neutral' },
  DO_NOT_CONTACT: { label: 'Do Not Contact', tone: 'bad' },
};

function dueInfo(iso) {
  if (!iso) return { label: 'No callback scheduled', isOverdue: false, isDueToday: false };
  const d = new Date(iso);
  const now = new Date();
  const isOverdue = d < now;
  const isDueToday = d.toDateString() === now.toDateString();

  return {
    label: d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    isOverdue,
    isDueToday,
  };
}

export default function CallQueue() {
  const [leads, setLeads] = useState([]);
  const [records, setRecords] = useState({});
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [mine, setMine] = useState(true);
  const [selectedStage, setSelectedStage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active Inspection & Activity Drawer
  const [inspectingRecord, setInspectingRecord] = useState(null);
  const [activeActivityLead, setActiveActivityLead] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ open_only: 'true' });
      if (onlyDue) params.set('due', 'true');
      if (mine) params.set('mine', 'true');

      const res = await apiFetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Could not load the queue.');
      const rows = await res.json();
      setLeads(rows);

      // Fetch corresponding record details
      const attached = rows.filter((l) => l.record_id);
      const fetched = await Promise.all(
        attached.map(async (l) => {
          try {
            const r = await apiFetch(`/api/records/${l.record_id}`);
            return r.ok ? [l.record_id, await r.json()] : null;
          } catch {
            return null;
          }
        })
      );
      setRecords(Object.fromEntries(fetched.filter(Boolean)));
    } catch (err) {
      setError(err.message || 'Failed to load call queue.');
    } finally {
      setLoading(false);
    }
  }, [onlyDue, mine]);

  useEffect(() => {
    load();
  }, [load]);

  // Stage counts for the pipeline strip
  const stageCounts = {
    NEW: 0,
    CONTACTED: 0,
    INTERESTED: 0,
    WON: 0,
  };
  leads.forEach((l) => {
    if (stageCounts[l.stage] !== undefined) stageCounts[l.stage] += 1;
  });

  // KPI Metrics
  const now = new Date();
  const overdueCount = leads.filter((l) => l.next_action_at && new Date(l.next_action_at) < now).length;
  const dueTodayCount = leads.filter((l) => {
    if (!l.next_action_at) return false;
    const d = new Date(l.next_action_at);
    return d.toDateString() === now.toDateString() && d >= now;
  }).length;

  // Filtered Leads
  const filteredLeads = leads.filter((l) => {
    if (selectedStage && l.stage !== selectedStage) return false;
    if (onlyOverdue) {
      if (!l.next_action_at || new Date(l.next_action_at) >= now) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const rec = records[l.record_id];
      const matchName = (rec?.name || '').toLowerCase().includes(q);
      const matchPhone = (rec?.mobile_1 || '').includes(q);
      const matchCommunity = (rec?.community || '').toLowerCase().includes(q);
      const matchBuilding = (rec?.building_cluster || rec?.building || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCommunity && !matchBuilding) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-w-[1520px] mx-auto">
      {/* Title band. The count line answers the desk's first question. */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-title">Call queue</h1>
          <p className="t-meta mt-1">
            <span className="num text-[var(--text-2)]">{leads.length}</span> open
            {' · '}
            <span className="num text-[var(--text-2)]">{dueTodayCount}</span> due today
            {' · '}
            <span className="num" style={{ color: overdueCount ? 'var(--bad)' : 'var(--text-2)' }}>{overdueCount}</span> overdue
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex rounded-[var(--r-md)] border border-[var(--edge)] overflow-hidden" role="group" aria-label="Whose queue">
            <button
              onClick={() => setMine(true)}
              aria-pressed={mine}
              className={`h-8 px-2.5 text-[12px] cursor-pointer transition-colors ${mine ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}`}
            >
              Mine
            </button>
            <button
              onClick={() => setMine(false)}
              aria-pressed={!mine}
              className={`h-8 px-2.5 text-[12px] cursor-pointer border-l border-[var(--edge)] transition-colors ${!mine ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}`}
            >
              Everyone
            </button>
          </div>
          <button
            onClick={() => setOnlyDue((v) => !v)}
            aria-pressed={onlyDue}
            className={`btn h-8 px-2.5 text-[12px] ${onlyDue ? 'border-[var(--accent-ring)] bg-[var(--accent-soft)]' : ''}`}
          >
            Due only
          </button>
          <button onClick={load} aria-label="Refresh queue" className="btn-ghost h-8 w-8">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <QueuePipeline stageCounts={stageCounts} selectedStage={selectedStage} onSelectStage={setSelectedStage} />

      {/* Narrowing: search, plus the active filters as chips beside it. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative flex-1 min-w-[220px] max-w-[420px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone or community"
            aria-label="Search the queue"
            className="field w-full h-8 pl-8 pr-3 text-[12.5px]"
          />
        </div>
        <button
          onClick={() => setOnlyOverdue((v) => !v)}
          aria-pressed={onlyOverdue}
          className={`btn h-8 px-2.5 text-[12px] ${onlyOverdue ? 'border-[var(--bad)]/40 bg-[var(--bad-soft)] text-[var(--bad)]' : ''}`}
        >
          Overdue{overdueCount > 0 && <span className="num ml-1 text-[11px]">{overdueCount}</span>}
        </button>
        {selectedStage && (
          <span className="chip">
            {STAGE_CONFIG[selectedStage]?.label}
            <button onClick={() => setSelectedStage(null)} aria-label="Clear stage filter" className="btn-ghost w-5 h-5 rounded-full">
              ×
            </button>
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 text-[12.5px] text-[var(--bad)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* The list. One surface, hairline rows: a lead is a line item, not a card.
          Columns answer who, why, when, what happened, then the actions. */}
      <section className="l2" aria-label="Leads">
        {!loading && !filteredLeads.length && !error ? (
          <div className="p-12 text-center">
            <Inbox className="w-7 h-7 mx-auto text-[var(--text-3)]" aria-hidden="true" />
            <div className="text-[13px] font-medium text-[var(--text)] mt-2.5">
              {mine ? 'Nothing in your queue' : 'The queue is empty'}
            </div>
            <p className="t-meta mt-1 max-w-sm mx-auto">Select records in Records and add them to the queue to start one.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--edge)]">
            {filteredLeads.map((lead) => {
              const record = records[lead.record_id];
              const due = dueInfo(lead.next_action_at);
              const stageCfg = STAGE_CONFIG[lead.stage] || { label: lead.stage, tone: 'neutral' };
              const where =
                [record?.building_cluster || record?.building, record?.unit_number ? `Unit ${record.unit_number}` : '']
                  .filter(Boolean)
                  .join(' · ') || record?.community || (record ? 'Property not recorded' : '—');
              return (
                <li
                  key={lead.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_9.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-[var(--row-hover)] transition-colors"
                >
                  {/* who */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-medium text-[var(--text)] truncate">
                        {record?.name || (
                          <span className="text-[var(--text-3)] font-normal">
                            {lead.record_id ? `Record #${lead.record_id}` : 'Awaiting relink'}
                          </span>
                        )}
                      </span>
                      {record?.status && <StatusBadge status={record.status} />}
                    </div>
                    <div className="t-meta truncate">
                      {record
                        ? `${record.nationality ? `${record.nationality} · ` : ''}${record.party_type || 'Individual owner'}`
                        : 'Record rewritten by a reprocess; history preserved'}
                    </div>
                  </div>

                  {/* why */}
                  <div className="min-w-0 text-[12.5px]">
                    <div className="text-[var(--text)] truncate">{where}</div>
                    <div className="t-meta truncate">
                      {record?.community || '—'}
                      {record?.procedure_value && (
                        <>
                          {' · '}
                          <span className="val">AED {Number(record.procedure_value).toLocaleString('en-US')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* when */}
                  <div className="text-[12.5px] flex items-center gap-1.5">
                    {due.isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-[var(--bad)] shrink-0" aria-hidden="true" />}
                    <span className={due.isOverdue ? 'text-[var(--bad)] font-medium' : lead.next_action_at ? 'text-[var(--text)]' : 't-meta'}>
                      {due.isOverdue ? `Overdue · ${due.label}` : due.label}
                    </span>
                  </div>

                  {/* what happened */}
                  <div className="min-w-0 flex items-center gap-2 text-[12px]">
                    <span className={`badge badge-${stageCfg.tone}`}>{stageCfg.label}</span>
                    <span className="t-meta truncate">{lead.activity_count ? `${lead.activity_count} calls` : 'First touch'}</span>
                  </div>

                  {/* actions: starting the call is the one primary thing here */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {record?.mobile_1 && (
                      <a
                        href={`tel:${record.mobile_1}`}
                        onClick={() => setActiveActivityLead(lead)}
                        className="btn-primary h-8 px-3 text-[12px]"
                        title={`Call ${record.mobile_1}`}
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Start call</span>
                      </a>
                    )}
                    <button onClick={() => setActiveActivityLead(lead)} className="btn h-8 px-2.5 text-[12px]" title="Log the outcome">
                      Log
                    </button>
                    {record && (
                      <button
                        onClick={() => setInspectingRecord(record)}
                        className="btn-ghost h-8 w-8"
                        title="Open the record"
                        aria-label="Open the record"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Drawer: Record Inspector */}
      {inspectingRecord && (
        <SidePanel
          isOpen={Boolean(inspectingRecord)}
          onClose={() => setInspectingRecord(null)}
          title={inspectingRecord.name || 'Property Record'}
          subtitle={`${inspectingRecord.community || 'Dubai'} · Unit ${inspectingRecord.unit_number || inspectingRecord.unit || '—'}`}
        >
          <RecordInspector
            record={inspectingRecord}
            onClose={() => setInspectingRecord(null)}
            onRecordUpdated={(updated) => {
              setRecords((prev) => ({ ...prev, [updated.id]: updated }));
              setInspectingRecord(updated);
            }}
          />
        </SidePanel>
      )}

      {/* Drawer: Lead Activity Logger */}
      {activeActivityLead && (
        <SidePanel
          isOpen={Boolean(activeActivityLead)}
          onClose={() => {
            setActiveActivityLead(null);
            load();
          }}
          title={`Outreach Log: ${records[activeActivityLead.record_id]?.name || `Lead #${activeActivityLead.id}`}`}
          subtitle="Log phone call results, set follow-up callback dates, or mark lead outcome"
        >
          <div className="space-y-4">
            {records[activeActivityLead.record_id]?.mobile_1 && (
              <div className="panel p-3 bg-[var(--color-surface-elevated)] flex items-center justify-between">
                <div>
                  <div className="t-label">Phone</div>
                  <div className="num font-bold text-[14px] text-[var(--color-text-primary)]">
                    {records[activeActivityLead.record_id].mobile_1}
                  </div>
                </div>
                <a
                  href={`tel:${records[activeActivityLead.record_id].mobile_1}`}
                  className="btn-primary h-7 px-3 text-[12px] flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Dial</span>
                </a>
              </div>
            )}

            <LeadActivityPanel recordId={activeActivityLead.record_id} />
          </div>
        </SidePanel>
      )}
    </div>
  );
}
