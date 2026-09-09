import React from 'react';
import { MapPin, Building2, Ruler, BedDouble } from 'lucide-react';

/**
 * The property, at a glance, at the top of the inspector.
 *
 * Replaces an isometric WebGL object. An operator opening a record needs the
 * valuation, the unit, and where it is -- a rotating wireframe communicated
 * none of those. The composition does the work instead: the value is the
 * largest thing on screen, the address line reads as one sentence, and the
 * unit sits in a recessed strip with the other identifiers.
 */
function fmtAed(v) {
  if (!v) return null;
  return `AED ${Number(v).toLocaleString('en-US')}`;
}

const TONE = {
  VALID: 'ok',
  DUPLICATE: 'dup',
  INCOMPLETE: 'warn',
  ERROR: 'bad',
  INVALID: 'bad',
};

export default function PropertySummary({ record }) {
  if (!record) return null;

  const value = fmtAed(record.procedure_value);
  const unit = record.unit_number || record.unit || (record.plot_number ? `Plot ${record.plot_number}` : null);
  const bedroom = record.bedroom || record.bedroom_type;
  const tone = TONE[record.status] || 'ok';

  const where = [record.building_cluster || record.building, record.sub_community, record.community]
    .filter(Boolean)
    .join(' · ');

  const facts = [
    { Icon: Building2, label: 'Unit', value: unit, mono: true },
    { Icon: BedDouble, label: 'Bedroom', value: bedroom },
    { Icon: Ruler, label: 'Size', value: record.size ? `${record.size} sq.ft` : null },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]"
      aria-label="Property summary"
    >
      {/* A single soft wash gives the block elevation without another card. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 60%)',
        }}
      />

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="t-label">Procedure value</div>
            <div
              className="num text-[26px] font-semibold leading-none tracking-tight mt-1.5"
              style={{ color: value ? 'var(--color-value)' : 'var(--color-text-muted)' }}
            >
              {value || 'Not recorded'}
            </div>
          </div>

          <span className={`badge badge-${tone} shrink-0`}>{record.status || 'VALID'}</span>
        </div>

        {where && (
          <div className="mt-3 flex items-start gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
            <MapPin className="w-3.5 h-3.5 mt-px shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
            <span className="min-w-0">{where}</span>
          </div>
        )}
      </div>

      {/* Recessed identifier strip: related facts, tightly spaced. */}
      <dl className="relative grid grid-cols-3 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
        {facts.map(({ Icon, label, value: v, mono }) => (
          <div key={label} className="px-3 py-2.5 min-w-0">
            <dt className="flex items-center gap-1.5 text-[10.5px] text-[var(--color-text-muted)]">
              <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
              {label}
            </dt>
            <dd
              className={`mt-1 text-[13px] truncate ${
                mono ? 'val' : 'text-[var(--color-text-primary)] font-medium'
              }`}
              title={v || ''}
            >
              {v || <span className="text-[var(--color-text-muted)]">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
