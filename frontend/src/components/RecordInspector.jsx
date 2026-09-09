import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  UserPlus,
  AlertCircle,
  Building2,
  Phone,
  Layers,
} from 'lucide-react';
import { StatusBadge } from './ui/Badge';
import LeadActivityPanel from './LeadActivityPanel';
import PropertySummary from './viz/PropertySummary';
import { apiFetch } from '../lib/api';
import { useToast } from '../lib/toast';

const SECTIONS = [
  {
    id: 'property',
    label: 'Property',
    icon: Building2,
    fields: [
      { key: 'community', label: 'Community' },
      { key: 'sub_community', label: 'Sub-community' },
      { key: 'building_cluster', label: 'Building / Cluster', read: (r) => r.building_cluster || r.building },
      { key: 'unit_number', label: 'Unit', read: (r) => r.unit_number || r.unit, val: true },
      { key: 'bedroom', label: 'Bedroom', read: (r) => r.bedroom || r.bedroom_type },
      { key: 'size', label: 'Size', type: 'number', read: (r) => (r.size ? `${r.size} sq.ft` : null) },
      { key: 'property_type', label: 'Property Type' },
      { key: 'developer', label: 'Developer' },
      { key: 'project', label: 'Project' },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: Phone,
    fields: [
      { key: 'name', label: 'Owner Name', span: 2 },
      { key: 'party_type', label: 'Party Type' },
      { key: 'mobile_1', label: 'Mobile 1', read: (r) => r.mobile_1 || r.mobile, num: true },
      { key: 'mobile_2', label: 'Mobile 2', num: true },
      { key: 'mobile_3', label: 'Mobile 3', num: true },
      { key: 'email_address', label: 'Email', type: 'email', span: 2 },
      { key: 'pi_number', label: 'PI Number / ID', num: true },
      { key: 'nationality', label: 'Nationality' },
    ],
  },
  {
    id: 'registry',
    label: 'Registry',
    icon: Layers,
    fields: [
      { key: 'plot_reg_no', label: 'Plot Reg. No', val: true },
      { key: 'plot_number', label: 'Plot Number', val: true },
      { key: 'dmno', label: 'DMNO', val: true },
      { key: 'dmsubno', label: 'DMSUBNO', val: true },
    ],
  },
];

const num = (v) => (v === '' || v == null ? null : Number(v));

export default function RecordInspector({
  record,
  onClose,
  onRecordUpdated,
  onNext,
  onPrev,
  hasPrev = false,
  hasNext = false,
  onAddToQueue,
  className = '',
}) {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'activity'
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (record) {
      setForm({ ...record });
      setIsEditing(false);
      setSaveError(null);
    }
  }, [record]);

  if (!record) return null;

  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(`/api/records/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server responded with ${res.status}`);
      }

      const updated = await res.json();
      notify('Record changes saved successfully.', { tone: 'ok' });
      setIsEditing(false);
      onRecordUpdated?.(updated);
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes.');
      notify(err.message || 'Failed to save record.', { tone: 'bad' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside
      aria-label="Record Inspector"
      className={`w-full lg:w-[460px] xl:w-[500px] shrink-0 h-full flex flex-col bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-xl overflow-hidden animate-fade-in ${className}`}
    >
      {/* Header: Identity, Prev/Next, Close */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono num">
              #{record.id}
            </span>
            <StatusBadge status={record.status} />
            {isEditing && <span className="badge badge-accent">Editing</span>}
          </div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight truncate">
            {record.name || record.developer || 'Record'}
          </h2>
          <p className="text-[12px] text-[var(--color-text-secondary)] truncate">
            {[record.community, record.building_cluster || record.building].filter(Boolean).join(', ') || 'Dubai, UAE'}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Previous / Next record navigation */}
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            title="Previous record (Arrow Up)"
            aria-label="Previous record"
            className="btn-ghost h-7 w-7 rounded-[var(--radius-sm)]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            title="Next record (Arrow Down)"
            aria-label="Next record"
            className="btn-ghost h-7 w-7 rounded-[var(--radius-sm)]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-[var(--color-border)] mx-1" />

          <button
            onClick={onClose}
            aria-label="Close inspector (Esc)"
            className="btn-ghost h-7 w-7 rounded-[var(--radius-sm)] hover:text-[var(--color-bad)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Bar / Direct Outreach Controls */}
      <div className="shrink-0 px-4 py-2 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {record.mobile_1 && (
            <a
              href={`tel:${record.mobile_1}`}
              className="btn-primary h-7 px-2.5 text-[12px] flex items-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>
          )}
          {onAddToQueue && (
            <button
              onClick={() => onAddToQueue(record.id)}
              className="btn h-7 px-2.5 text-[12px] flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Queue</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="btn h-7 px-2.5 text-[12px] flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setForm({ ...record });
                }}
                className="btn-ghost h-7 px-2 text-[12px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary h-7 px-3 text-[12px] flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                <span>Save</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Switcher: Property Details vs Outreach Activity */}
      <div className="shrink-0 px-4 pt-2 border-b border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface)]">
        <button
          onClick={() => setActiveTab('details')}
          className={`pb-2 text-[12.5px] font-medium transition-colors border-b-2 ${
            activeTab === 'details'
              ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-semibold'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Property & Identity
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-2 text-[12.5px] font-medium transition-colors border-b-2 ${
            activeTab === 'activity'
              ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-semibold'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Outreach & Activity
        </button>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        {saveError && (
          <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad)] text-[12px] flex items-center gap-2 border border-[var(--color-bad)]/30">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {activeTab === 'details' ? (
          <>
            {/* Value, status and location, before the field-by-field detail */}
            <PropertySummary record={record} />

            {/* Core Sections */}
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              return (
                <section key={sec.id} className="panel p-3.5 space-y-2.5 rounded-[var(--radius-lg)]">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--color-border)]">
                    <Icon className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {sec.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {sec.fields.map((f) => {
                      const shown = f.read ? f.read(record) : record[f.key];
                      const span = f.span === 2 ? 'col-span-2' : '';
                      return (
                        <div key={f.key} className={`min-w-0 ${span}`}>
                          <div className="text-[10.5px] text-[var(--color-text-muted)] uppercase font-semibold tracking-wider mb-0.5">
                            {f.label}
                          </div>
                          {isEditing ? (
                            <input
                              type={f.type || 'text'}
                              value={form[f.key] ?? ''}
                              onChange={(e) =>
                                setField(f.key, f.type === 'number' ? num(e.target.value) : e.target.value)
                              }
                              aria-label={f.label}
                              className={`field w-full h-7 px-2 text-[12px] ${f.val || f.num ? 'num' : ''}`}
                            />
                          ) : (
                            <div
                              className={`text-[12.5px] truncate font-medium ${
                                f.val ? 'val' : f.num ? 'num text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'
                              }`}
                              title={shown || ''}
                            >
                              {shown || <span className="text-[var(--color-text-muted)] font-normal">—</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </>
        ) : (
          <div className="pt-1">
            <LeadActivityPanel recordId={record.id} />
          </div>
        )}
      </div>

      {/* Provenance Footer */}
      <div className="shrink-0 px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[11px] text-[var(--color-text-muted)] flex items-center justify-between gap-2">
        <span className="truncate">
          Source: <span className="text-[var(--color-text-secondary)] font-medium">{record.source_file || 'Register'}</span>
          <span className="num font-mono"> row {record.source_row ?? '1'}</span>
        </span>
        <kbd className="hidden sm:inline-block h-5 px-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] leading-5">
          Esc
        </kbd>
      </div>
    </aside>
  );
}
