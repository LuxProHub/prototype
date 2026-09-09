import React from 'react';

export default function Tilt3DCard({ children, className = '' }) {
  return (
    <div className={`panel-interactive ${className}`}>
      {children}
    </div>
  );
}
