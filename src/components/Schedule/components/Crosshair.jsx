import React from 'react';

/**
 * Vertical crosshair line that follows mouse position on the timeline.
 */
export const Crosshair = ({ x }) => {
  if (x === null) {
    return null;
  }

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-slate-900 opacity-20 z-0 pointer-events-none"
      style={{ left: x }}
    />
  );
};
