import React from 'react';

/**
 * Liquid Spatial Atmospheric Backdrop
 *
 * Multi-layered atmospheric lighting creating deep visual depth:
 * - Deep obsidian void base (#050811)
 * - Soft azure atmospheric light cone from the top-left
 * - Subtle deep indigo / violet ambient dispersion in the center-right
 * - Warm brass low-horizon glow on the bottom-right
 * 100% 2D spatial lighting, zero canvas/WebGL overhead, zero grid artifacts.
 */
export default function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050811]"
    >
      {/* Top-left deep azure atmospheric lighting */}
      <div
        className="absolute -top-[25%] -left-[15%] w-[70vw] h-[60vh] rounded-full blur-[150px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(37, 99, 235, 0.12) 0%, rgba(29, 78, 216, 0.04) 50%, transparent 75%)',
        }}
      />

      {/* Top-center soft cold ambient illumination */}
      <div
        className="absolute -top-[10%] left-[35%] w-[45vw] h-[35vh] rounded-full blur-[160px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.06) 0%, transparent 70%)',
        }}
      />

      {/* Mid-right subtle violet/amethyst spatial depth */}
      <div
        className="absolute top-[25%] -right-[15%] w-[55vw] h-[45vh] rounded-full blur-[170px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.05) 0%, rgba(15, 23, 42, 0) 70%)',
        }}
      />

      {/* Bottom-right warm restrained brass/gold glow */}
      <div
        className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vh] rounded-full blur-[160px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(212, 175, 55, 0.05) 0%, rgba(180, 130, 20, 0.02) 45%, transparent 70%)',
        }}
      />

      {/* Very faint center-bottom grounding shadow */}
      <div
        className="absolute bottom-0 left-[20%] w-[60vw] h-[25vh] rounded-full blur-[140px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.4) 0%, transparent 80%)',
        }}
      />
    </div>
  );
}