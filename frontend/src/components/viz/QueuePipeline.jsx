import React from 'react';
import { PhoneCall, PhoneOutgoing, CalendarClock, CheckCircle2 } from 'lucide-react';

/**
 * The call queue as a pipeline, in two dimensions.
 *
 * Replaces a WebGL ribbon. What an operator needs from this strip is a count
 * per stage and a way to filter to one, and a flat composition says that more
 * clearly than a rotating one did: the stages read left to right, the
 * connectors carry the eye between them, and the selected stage is the only
 * one that lifts.
 *
 * Depth here is layering and elevation -- a raised selected tile against a
 * recessed rail -- not perspective.
 */
const STAGES = [
  { key: 'NEW', label: 'Ready', hint: 'Not yet contacted', Icon: PhoneCall, tone: 'accent' },
  { key: 'CONTACTED', label: 'Calling', hint: 'Contact attempted', Icon: PhoneOutgoing, tone: 'warn' },
  { key: 'INTERESTED', label: 'Follow-up', hint: 'Interested, needs a callback', Icon: CalendarClock, tone: 'dup' },
  { key: 'WON', label: 'Completed', hint: 'Closed won', Icon: CheckCircle2, tone: 'ok' },
];

export default function QueuePipeline({ stageCounts = {}, selectedStage, onSelectStage }) {
  const total = STAGES.reduce((n, s) => n + (stageCounts[s.key] || 0), 0);

  return (
    <div className="panel rounded-[var(--radius-lg)] p-1.5">
      <ol className="flex items-stretch gap-1" aria-label="Call pipeline stages">
        {STAGES.map((s, i) => {
          const count = stageCounts[s.key] || 0;
          const active = selectedStage === s.key;
          const share = total ? Math.round((count / total) * 100) : 0;
          return (
            <React.Fragment key={s.key}>
              <li className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectStage?.(active ? null : s.key)}
                  aria-pressed={active}
                  className={`group w-full h-full text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-all duration-[var(--dur-2)] cursor-pointer border ${
                    active
                      ? 'bg-[var(--color-surface)] border-[var(--color-accent)]/45 shadow-[var(--shadow-2)]'
                      : 'bg-[var(--color-surface-elevated)] border-transparent hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <s.Icon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: `var(--color-${s.tone})` }}
                      aria-hidden="true"
                    />
                    <span className="t-label truncate">{s.label}</span>
                  </div>

                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="num text-[20px] font-semibold leading-none text-[var(--color-text-primary)]">
                      {count}
                    </span>
                    {total > 0 && (
                      <span className="num text-[11px] text-[var(--color-text-muted)]">{share}%</span>
                    )}
                  </div>

                  {/* A share rail rather than a chart: it is a proportion, not a trend. */}
                  <div className="mt-2 h-[3px] rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${share}%`, background: `var(--color-${s.tone})` }}
                    />
                  </div>

                  <div className="mt-1.5 text-[10.5px] text-[var(--color-text-muted)] truncate">{s.hint}</div>
                </button>
              </li>

              {i < STAGES.length - 1 && (
                <li aria-hidden="true" className="hidden sm:flex items-center shrink-0 px-0.5">
                  <span className="w-3 h-px bg-[var(--color-border-strong)]" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
