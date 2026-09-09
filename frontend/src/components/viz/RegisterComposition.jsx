import React from 'react';

/**
 * What the register is made of, and where it is concentrated.
 *
 * This occupies the large bento cell that previously held a WebGL scene. It
 * answers the two questions the page actually exists to answer -- how clean is
 * the data, and where does it sit -- using proportion and ranking rather than
 * perspective.
 *
 * Composition is a single stacked rail, not four donuts: the whole point is
 * that these four numbers are parts of one total, and separate cards lose that.
 */
const BANDS = [
  { key: 'valid', label: 'Valid', tone: 'ok', hint: 'Name plus a reachable contact' },
  { key: 'duplicate', label: 'Duplicate', tone: 'dup', hint: 'Matched another record by identity' },
  { key: 'incomplete', label: 'Incomplete', tone: 'warn', hint: 'Missing a name or contact' },
  { key: 'error', label: 'Error', tone: 'bad', hint: 'Failed validation' },
];

function pct(n, total) {
  if (!total) return 0;
  return (n / total) * 100;
}

export default function RegisterComposition({ stats }) {
  const valid = stats?.valid_records ?? 0;
  const duplicate = stats?.duplicate_records ?? 0;
  const error = stats?.total_errors ?? 0;
  const total = stats?.total_records ?? 0;
  // Whatever is not accounted for by the other three is incomplete; deriving it
  // keeps the rail summing to the headline total instead of quietly not.
  const incomplete = Math.max(0, total - valid - duplicate - error);

  const values = { valid, duplicate, incomplete, error };
  const communities = (stats?.community_distribution || []).slice(0, 7);
  const topCount = communities[0]?.count || 1;

  return (
    <div className="h-full flex flex-col p-5 gap-5">
      {/* Composition ------------------------------------------------------ */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Register composition
            </div>
            <div className="num text-[30px] sm:text-[34px] font-semibold leading-none tracking-tight text-[var(--color-text-primary)] mt-1.5">
              {total.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="num text-[19px] font-semibold leading-none text-[var(--color-ok)]">
              {pct(valid, total).toFixed(1)}%
            </div>
            <div className="text-[10.5px] text-[var(--color-text-muted)] mt-1">usable</div>
          </div>
        </div>

        {/* One rail, four parts. */}
        <div
          className="mt-4 h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--color-surface-muted)]"
          role="img"
          aria-label={BANDS.map((b) => `${b.label} ${Math.round(pct(values[b.key], total))}%`).join(', ')}
        >
          {BANDS.map((b) => {
            const w = pct(values[b.key], total);
            if (w <= 0) return null;
            return (
              <div
                key={b.key}
                className="h-full transition-[width] duration-700"
                style={{ width: `${w}%`, background: `var(--color-${b.tone})` }}
              />
            );
          })}
        </div>

        <dl className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          {BANDS.map((b) => (
            <div key={b.key} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: `var(--color-${b.tone})` }}
                />
                <span className="truncate">{b.label}</span>
              </dt>
              <dd className="num text-[15px] font-semibold text-[var(--color-text-primary)] mt-0.5">
                {values[b.key].toLocaleString()}
              </dd>
              <dd className="text-[10.5px] text-[var(--color-text-muted)] leading-snug mt-0.5">
                {b.hint}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Concentration ---------------------------------------------------- */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-[var(--color-border)] pt-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Where it sits
          </div>
          <div className="text-[10.5px] text-[var(--color-text-muted)]">
            top {communities.length} of {(stats?.community_distribution || []).length || '—'}
          </div>
        </div>

        {communities.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-muted)] mt-3">
            Upload a register to see how holdings are distributed.
          </p>
        ) : (
          <ul className="mt-2.5 flex-1 min-h-0 space-y-[7px] overflow-y-auto pr-0.5">
            {communities.map((c, i) => (
              <li key={`${c.name}-${i}`} className="group">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-[var(--color-text-primary)] truncate">
                    {c.name || 'Unspecified'}
                  </span>
                  <span className="num text-[12px] text-[var(--color-text-secondary)] shrink-0 tabular-nums">
                    {c.count.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 h-[3px] rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${(c.count / topCount) * 100}%`,
                      // The leader is brass; the rest recede. Rank is the message.
                      background: i === 0 ? 'var(--color-value)' : 'var(--color-accent)',
                      opacity: i === 0 ? 1 : Math.max(0.32, 1 - i * 0.11),
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
