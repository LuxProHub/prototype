import React from 'react';

/**
 * Liquid Spatial Atmospheric Backdrop
 *
 * Multi-layered atmospheric lighting with slow, organic fluid motions:
 * - Dual Light / Dark Mode support
 * - Light Mode: Clean luminous porcelain base (#f8fafc) with ethereal pastel fluid orbs
 * - Dark Mode: Deep obsidian void base (#050811) with radiant fluid orbs
 * 100% 2D CSS-accelerated fluid lighting, zero WebGL, ultra-smooth 60fps.
 */
export default function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#f8fafc] dark:bg-[#050811] transition-colors duration-500"
    >
      {/* Top-left animated fluid azure atmospheric lighting */}
      <div
        className="absolute -top-[25%] -left-[15%] w-[70vw] h-[65vh] rounded-full blur-[140px] pointer-events-none animate-fluid-float-a opacity-90"
        style={{
          background: 'radial-gradient(ellipse at center, var(--accent-soft) 0%, rgba(37, 99, 235, 0.04) 50%, transparent 75%)',
        }}
      />

      {/* Top-center animated fluid cyan/sky illumination */}
      <div
        className="absolute -top-[10%] left-[30%] w-[50vw] h-[40vh] rounded-full blur-[150px] pointer-events-none animate-fluid-float-b opacity-80"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(14, 165, 233, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Mid-right animated violet/amethyst spatial depth */}
      <div
        className="absolute top-[20%] -right-[15%] w-[55vw] h-[50vh] rounded-full blur-[160px] pointer-events-none animate-fluid-float-c opacity-85"
        style={{
          background: 'radial-gradient(ellipse at center, var(--dup-soft) 0%, transparent 70%)',
        }}
      />

      {/* Bottom-right animated warm brass/gold luxury glow */}
      <div
        className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vh] rounded-full blur-[150px] pointer-events-none animate-fluid-float-a opacity-75"
        style={{
          background: 'radial-gradient(ellipse at center, var(--value-soft) 0%, transparent 70%)',
        }}
      />

      {/* Center-bottom grounding shadow for dark mode */}
      <div
        className="hidden dark:block absolute bottom-0 left-[15%] w-[70vw] h-[30vh] rounded-full blur-[130px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(10, 15, 29, 0.5) 0%, transparent 80%)',
        }}
      />
    </div>
  );
}