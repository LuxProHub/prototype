import React from 'react';

/**
 * Liquid Spatial Atmospheric Backdrop
 *
 * Quiet, calm, expensive atmosphere using layered radial gradients.
 * No grid lines, no dots, no blueprint/technical textures, no noise artifacts.
 * The background serves as subtle atmosphere; the operational content is the hero.
 */
export default function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#060911]"
    >
      {/* Primary soft azure illumination from top-left */}
      <div
        className="absolute -top-[20%] -left-[10%] w-[65vw] h-[55vh] rounded-full blur-[140px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.07) 0%, rgba(15, 23, 42, 0) 70%)',
        }}
      />

      {/* Gentle center atmospheric lift */}
      <div
        className="absolute top-[30%] left-[25%] w-[50vw] h-[40vh] rounded-full blur-[160px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(30, 41, 59, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
        }}
      />

      {/* Subtle warm brass ambient warmth at the bottom right */}
      <div
        className="absolute -bottom-[15%] -right-[10%] w-[55vw] h-[50vh] rounded-full blur-[150px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(197, 155, 39, 0.04) 0%, rgba(6, 9, 17, 0) 70%)',
        }}
      />
    </div>
  );
}