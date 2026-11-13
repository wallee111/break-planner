import React from 'react';

/**
 * Vertical crosshair line that follows mouse position on the timeline.
 *
 * Position is driven imperatively through `lineRef` (style.left / display)
 * rather than React state: mousemove fires constantly, and a setState per
 * move re-rendered the entire timeline + labor chart, which triggered
 * "Maximum update depth exceeded" warnings.
 */
export const Crosshair = ({ lineRef }) => (
  <div
    ref={lineRef}
    className="absolute top-0 bottom-0 w-px bg-slate-900 opacity-20 z-0 pointer-events-none"
    style={{ display: 'none', left: 0 }}
  />
);
