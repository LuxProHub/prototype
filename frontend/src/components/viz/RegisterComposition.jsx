import React from 'react';

/**
 * Geographic & Community Distribution
 *
 * Shows where registry holdings are concentrated across master communities.
 * Highlights the leader in warm restrained brass, with smooth proportional
 * distribution bars and tabular counts. Clicking any row immediately drills down
 * into Records filtered by that community.
 */
export default function RegisterComposition({ stats, onSelectCommunity }) {
  const total = stats?.total_records ?? 0;
  const communities = (stats?.community_distribution || []).slice(0, 8);
  const topCount = communities[0]?.count || 1;

  if (!communities.length) {
    return (
      <div className="py-12 text-center text-[13px] text-[var(--text-3)]">
        Upload or process a register to view community concentration.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider pb-2 border-b border-[var(--edge)]">
        <span>Master Community</span>
        <div className="flex items-center gap-6">
          <span>Records</span>
          <span className="w-12 text-right">Share</span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {communities.map((c, i) => {
          const share = total > 0 ? ((c.count / total) * 100).toFixed(1) : '0';
          const isLeader = i === 0;

          return (
            <li key={`${c.name}-${i}`}>
              <button
                type="button"
                onClick={() => onSelectCommunity?.(c.name)}
                className="w-full text-left group p-1.5 -m-1.5 rounded-[var(--r-sm)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                title={`Filter records in ${c.name || 'Unspecified Community'}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 text-[11px] font-mono shrink-0 ${
                        isLeader ? 'text-[var(--value)] font-bold' : 'text-[var(--text-3)]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[12.5px] font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {c.name || 'Unspecified Community'}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <span className="num text-[12.5px] font-semibold text-[var(--text)]">
                      {c.count.toLocaleString()}
                    </span>
                    <span className="num text-[11.5px] text-[var(--text-3)] w-12 text-right">
                      {share}%
                    </span>
                  </div>
                </div>

                {/* Proportional distribution bar */}
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(c.count / topCount) * 100}%`,
                      background: isLeader ? 'var(--value)' : 'var(--accent)',
                      opacity: isLeader ? 1 : Math.max(0.4, 0.9 - i * 0.08),
                    }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
