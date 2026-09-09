import React from 'react';

/**
 * Ambient depth behind the shell: two soft light sources and a fine technical
 * grid, painted as CSS gradients. There is no canvas and no render loop -- the
 * atmosphere is what glass surfaces blur against, so it only needs to exist,
 * not to animate.
 */
export default function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 bg-[var(--ink)]"
      style={{
        backgroundImage: [
          'radial-gradient(1100px 700px at 8% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%)',
          'radial-gradient(900px 600px at 104% 108%, color-mix(in srgb, var(--value) 10%, transparent), transparent 60%)',
          'linear-gradient(color-mix(in srgb, var(--edge) 55%, transparent) 1px, transparent 1px)',
          'linear-gradient(90deg, color-mix(in srgb, var(--edge) 55%, transparent) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
        backgroundPosition: '0 0, 0 0, -1px -1px, -1px -1px',
      }}
    />
  );
}
