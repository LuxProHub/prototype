import React from 'react';

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.32 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export default function AmbientBackdrop() {
  return <div aria-hidden="true" className="ambient-field fixed inset-0 pointer-events-none z-0">
    <div className="ambient-field__light" />
    <div className="ambient-field__grain" style={{ backgroundImage: GRAIN }} />
  </div>;
}