import React from 'react';
import { Upload, Columns3, ShieldCheck, Cpu, Copy, CheckCircle2 } from 'lucide-react';

/**
 * The ingestion pipeline, as a strip.
 *
 * Upload was a dropzone floating over an empty page: nothing told an operator
 * what happens after the file lands. This names the six steps every register
 * goes through and lights the one in progress. It is a process, not a
 * distribution, so there are no counts -- just position.
 */
const STAGES = [
  { key: 'upload', label: 'Upload', hint: 'xlsx, xls or csv', Icon: Upload },
  { key: 'mapping', label: 'Mapping', hint: 'headers to fields', Icon: Columns3 },
  { key: 'validation', label: 'Validation', hint: 'names and contacts', Icon: ShieldCheck },
  { key: 'processing', label: 'Processing', hint: 'cleaning in batches', Icon: Cpu },
  { key: 'dedup', label: 'Deduplication', hint: 'by identity hash', Icon: Copy },
  { key: 'ready', label: 'Ready', hint: 'in the register', Icon: CheckCircle2 },
];

export default function IngestStages({ stage = 'upload' }) {
  const activeIndex = Math.max(0, STAGES.findIndex((s) => s.key === stage));

  return (
    <ol className="flex items-stretch gap-1 sm:gap-1.5 overflow-x-auto" aria-label="Ingestion stages">
      {STAGES.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <React.Fragment key={s.key}>
            <li
              className={`flex-1 min-w-[7.5rem] rounded-[var(--r-md)] px-3 py-2.5 border transition-colors ${
                active
                  ? 'bg-[var(--surface)] border-[var(--accent-ring)] shadow-[var(--shadow-1)]'
                  : 'bg-transparent border-transparent'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <div className="flex items-center gap-2">
                <s.Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: done ? 'var(--ok)' : active ? 'var(--accent)' : 'var(--text-3)' }}
                  aria-hidden="true"
                />
                <span className={`text-[12.5px] truncate ${active ? 'text-[var(--text)] font-medium' : done ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]'}`}>
                  {s.label}
                </span>
              </div>
              <div className="t-meta mt-0.5 truncate">{s.hint}</div>
            </li>
            {i < STAGES.length - 1 && (
              <li aria-hidden="true" className="hidden sm:flex items-center shrink-0">
                <span
                  className="w-2.5 h-px"
                  style={{ background: i < activeIndex ? 'var(--ok)' : 'var(--edge-strong)' }}
                />
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
