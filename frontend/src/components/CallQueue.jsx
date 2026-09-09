import React, { useCallback, useEffect, useState } from 'react';
import {
  PhoneCall,
  CalendarClock,
  RefreshCw,
  Inbox,
  AlertCircle,
  Clock,
  CheckCircle2,
  Building2,
  User,
  Search,
  ChevronRight,
} from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Call queue"
        description="Operational sales command center. Priority leads with scheduled actions, soonest first."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMine((v) => !v)}
              className={`h-8 sm:h-9 px-3 rounded-[var(--radius-md)] text-[12.5px] font-semibold transition-all cursor-pointer ${
                mine ? 'btn-primary' : 'btn text-[var(--color-text-secondary)]'
              }`}
            >
              {mine ? 'My Queue' : 'All Callers'}
            </button>
            <button
              onClick={() => setOnlyDue((v) => !v)}
              className={`h-8 sm:h-9 px-3 rounded-[var(--radius-md)] text-[12.5px] font-semibold transition-all cursor-pointer ${
                onlyDue ? 'btn-primary' : 'btn text-[var(--color-text-secondary)]'
              }`}
            >
              Due Only
            </button>
            <button
              onClick={load}
              aria-label="Refresh queue"
              className="btn h-8 sm:h-9 w-8 sm:w-9 p-0 flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Pipeline strip: READY -> CALLING -> FOLLOW-UP -> COMPLETED */}
      <QueuePipeline
        stageCounts={stageCounts}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
      />

      {/* Operational KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="panel p-3.5 rounded-[var(--radius-lg)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Due Today
            </span>
            <Clock className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold num mt-1 text-[var(--color-text-primary)]">
            {dueTodayCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Scheduled for today</p>
        </div>

        <div
          onClick={() => setOnlyOverdue((v) => !v)}
          className={`panel p-3.5 rounded-[var(--radius-lg)] cursor-pointer transition-all ${
            onlyOverdue ? 'border-[var(--color-bad)] shadow-md' : 'hover:border-[var(--color-border-strong)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-bad)]">
              Overdue
            </span>
            <AlertCircle className="w-4 h-4 text-[var(--color-bad)]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold num mt-1 text-[var(--color-bad)]">
            {overdueCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Needs immediate call</p>
        </div>

        <div className="panel p-3.5 rounded-[var(--radius-lg)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Assigned to You
            </span>
            <User className="w-4 h-4 text-[var(--color-ok)]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold num mt-1 text-[var(--color-text-primary)]">
            {leads.length}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Active assigned leads</p>
        </div>

        <div className="panel p-3.5 rounded-[var(--radius-lg)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Completed Deals
            </span>
            <CheckCircle2 className="w-4 h-4 text-[var(--color-ok)]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold num mt-1 text-[var(--color-ok)]">
            {stageCounts.WON}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Successfully closed</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-[var(--color-surface)] p-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter queue by lead name, phone, or community..."
            className="field w-full h-8 pl-9 pr-3 text-[12.5px]"
          />
        </div>

        {selectedStage && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2.5 py-1 rounded-full font-medium">
            <span>Filtered stage: {STAGE_CONFIG[selectedStage]?.label}</span>
            <button onClick={() => setSelectedStage(null)} className="hover:opacity-75 cursor-pointer">×</button>
          </div>
        )}
        {onlyOverdue && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-bad)] bg-[var(--color-bad-soft,#fb718520)] px-2.5 py-1 rounded-full font-medium">
            <span>Only Overdue</span>
            <button onClick={() => setOnlyOverdue(false)} className="hover:opacity-75 cursor-pointer">×</button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad)] text-[12px] flex items-center gap-2 border border-[var(--color-bad)]/30">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !filteredLeads.length && !error && (
        <div className="panel rounded-[var(--radius-lg)] p-12 text-center space-y-2.5">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center">
            <Inbox className="w-6 h-6 text-[var(--color-text-muted)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">No leads in this queue</h3>
          <p className="text-[12px] text-[var(--color-text-muted)] max-w-sm mx-auto">
            {mine ? 'No leads matching your current criteria are assigned to you.' : 'The queue is completely clear.'}{' '}
            Explore records to queue new leads.
          </p>
        </div>
      )}

      {/* Queue Items List (Who / Why / When / What Happened) */}
      <div className="space-y-2.5">
        {filteredLeads.map((lead) => {
          const record = records[lead.record_id];
          const due = dueInfo(lead.next_action_at);
          const stageCfg = STAGE_CONFIG[lead.stage] || { label: lead.stage, tone: 'neutral' };

          return (
            <div
              key={lead.id}
              className={`panel p-3.5 sm:p-4 rounded-[var(--radius-lg)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 transition-all hover:border-[var(--color-border-strong)] ${
                due.isOverdue ? 'border-l-4 border-l-[var(--color-bad)]' : 'border-l-4 border-l-[var(--color-accent)]'
              }`}
            >
              {/* WHO: Lead Contact & Identity */}
              <div className="min-w-0 md:w-56 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13.5px] text-[var(--color-text-primary)] truncate" title={record?.name || ''}>
                    {record?.name || (
                      // record_id is ON DELETE SET NULL: reprocessing a job
                      // detaches a lead until relink_leads() reattaches it by
                      // identity_hash. The call history is intact -- say that,
                      // rather than rendering "Record #" with nothing after it.
                      <span className="text-[var(--color-text-muted)] font-normal">
                        {lead.record_id ? `Record #${lead.record_id}` : 'Awaiting relink'}
                      </span>
                    )}
                  </span>
                  {record?.status && <StatusBadge status={record.status} />}
                </div>

                <div className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5 truncate">
                  {record
                    ? `${record.nationality ? `${record.nationality} · ` : ''}${record.party_type || 'Individual owner'}`
                    : 'Record rewritten by a reprocess; history preserved'}
                </div>
              </div>

              {/* WHY: Property & Unit Context */}
              <div className="min-w-0 md:w-56 shrink-0 text-[12px]">
                <div className="flex items-center gap-1.5 text-[var(--color-text-primary)] font-medium truncate">
                  <Building2 className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                  <span className="truncate">
                    {[record?.building_cluster || record?.building, record?.unit_number ? `Unit ${record.unit_number}` : '']
                      .filter(Boolean).join(' · ') || record?.community || (record ? 'Property not recorded' : '—')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  <span className="truncate">{record?.community || '—'}</span>
                  {record?.procedure_value && (
                    <>
                      <span>·</span>
                      <span className="val font-semibold">AED {Number(record.procedure_value).toLocaleString('en-US')}</span>
                    </>
                  )}
                </div>
              </div>

              {/* WHEN: Due Time & Overdue Flag */}
              <div className="min-w-0 md:w-44 shrink-0 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className={`w-3.5 h-3.5 shrink-0 ${due.isOverdue ? 'text-[var(--color-bad)]' : 'text-[var(--color-text-muted)]'}`} />
                  <span className={`font-semibold ${due.isOverdue ? 'text-[var(--color-bad)]' : 'text-[var(--color-text-primary)]'}`}>
                    {due.label}
                  </span>
                </div>
                {due.isOverdue && (
                  <span className="inline-block text-[10px] uppercase font-bold text-[var(--color-bad)] bg-[var(--color-bad-soft,#fb718520)] px-1.5 py-0.2 rounded mt-0.5">
                    Overdue Callback
                  </span>
                )}
              </div>

              {/* WHAT HAPPENED: Stage Badge & Last Notes */}
              <div className="min-w-0 flex-1 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className={`badge badge-${stageCfg.tone}`}>
                    {stageCfg.label}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {lead.activity_count ? `${lead.activity_count} calls logged` : 'First touch'}
                  </span>
                </div>
                {lead.last_notes && (
                  <p className="text-[11.5px] text-[var(--color-text-secondary)] italic truncate mt-1">
                    "{lead.last_notes}"
                  </p>
                )}
              </div>

              {/* OPERATIONAL ACTIONS */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 w-full md:w-auto justify-end border-t md:border-t-0 border-[var(--color-border)]">
                {record?.mobile_1 && (
                  <a
                    href={`tel:${record.mobile_1}`}
                    onClick={() => setActiveActivityLead(lead)}
                    className="btn-primary h-8 px-3 text-[12px] flex items-center gap-1.5 shadow-sm"
                    title={`Call ${record.mobile_1}`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Start Call</span>
                  </a>
                )}

                <button
                  onClick={() => setActiveActivityLead(lead)}
                  className="btn h-8 px-2.5 text-[12px]"
                  title="Log call activity and update stage"
                >
                  Log
                </button>

                {record && (
                  <button
                    onClick={() => setInspectingRecord(record)}
                    className="btn-ghost h-8 w-8 rounded-[var(--radius-sm)]"
                    title="View property record details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                  <div className="text-[11px] text-[var(--color-text-muted)] uppercase font-semibold">Phone Number</div>
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
