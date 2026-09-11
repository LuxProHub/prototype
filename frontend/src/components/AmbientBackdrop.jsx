import React from 'react';

/**
 * Liquid Spatial Atmospheric Backdrop
 *
 * Multi-layered atmospheric lighting with slow, organic fluid motions:
 * - Deep obsidian void base (#050811)
 * - Animated fluid azure orb drifting top-left
 * - Animated fluid cyan/sky orb drifting top-center
 * - Animated deep indigo/violet fluid dispersion center-right
 * - Animated warm gold/brass glow bottom-right
 * 100% 2D CSS-accelerated fluid lighting, zero WebGL, ultra-smooth 60fps.
 */
export default function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050811]"
    >
      {/* Top-left animated fluid azure atmospheric lighting */}
      <div
        className="absolute -top-[25%] -left-[15%] w-[70vw] h-[65vh] rounded-full blur-[140px] pointer-events-none animate-fluid-float-a opacity-90"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(37, 99, 235, 0.16) 0%, rgba(29, 78, 216, 0.05) 50%, transparent 75%)',
        }}
      />

      {/* Top-center animated fluid cyan/sky illumination */}
      <div
        className="absolute -top-[10%] left-[30%] w-[50vw] h-[40vh] rounded-full blur-[150px] pointer-events-none animate-fluid-float-b opacity-80"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.08) 0%, rgba(37, 99, 235, 0.03) 50%, transparent 70%)',
        }}
      />

      {/* Mid-right animated violet/amethyst spatial depth */}
      <div
        className="absolute top-[20%] -right-[15%] w-[55vw] h-[50vh] rounded-full blur-[160px] pointer-events-none animate-fluid-float-c opacity-85"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.08) 0%, rgba(79, 70, 229, 0.03) 50%, transparent 70%)',
        }}
      />

      {/* Bottom-right animated warm brass/gold luxury glow */}
      <div
        className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vh] rounded-full blur-[150px] pointer-events-none animate-fluid-float-a opacity-75"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(212, 175, 55, 0.07) 0%, rgba(180, 130, 20, 0.03) 45%, transparent 70%)',
        }}
      />

      {/* Center-bottom grounding shadow to keep tables and data razor-sharp */}
      <div
        className="absolute bottom-0 left-[15%] w-[70vw] h-[30vh] rounded-full blur-[130px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(10, 15, 29, 0.5) 0%, transparent 80%)',
        }}
      />
    </div>
  );
}