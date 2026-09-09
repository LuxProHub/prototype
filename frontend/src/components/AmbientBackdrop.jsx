import React from 'react';

/**
 * The environment behind the workspace.
 *
 * Liquid Spatial lives or dies here: glass surfaces need something behind them
 * to blur, and a flat colour gives them nothing. So the page ground carries
 * two soft light sources -- azure high on the left, a warmer brass low on the
 * right -- a fine technical grid that recedes, and a grain overlay that stops
 * the gradients from reading as a screensaver.
 *
 * Painted entirely with CSS. No canvas, no loop; it only needs to exist.
 */

// 4x4 monochrome noise, tiled. Small enough to inline; big enough to break
// banding on the gradients underneath it.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export default function AmbientBackdrop() {
  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 bg-[var(--ink)]">
      {/* Light sources */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(1200px 760px at 6% -12%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 62%)',
            'radial-gradient(900px 640px at 102% 104%, color-mix(in srgb, var(--value) 12%, transparent), transparent 60%)',
            'radial-gradient(700px 500px at 50% 120%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 60%)',
          ].join(','),
        }}
      />
      {/* Technical grid, fading toward the horizon */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'linear-gradient(color-mix(in srgb, var(--edge) 70%, transparent) 1px, transparent 1px)',
            'linear-gradient(90deg, color-mix(in srgb, var(--edge) 70%, transparent) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '48px 48px, 48px 48px',
          backgroundPosition: '-1px -1px',
          maskImage: 'radial-gradient(130% 100% at 50% 0%, black 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(130% 100% at 50% 0%, black 30%, transparent 85%)',
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, opacity: 0.35 }}
      />
    </div>
  );
}
