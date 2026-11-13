import React from 'react';
import { SIDEBAR_WIDTH } from '../../../utils/constants';

/**
 * Displays a vertical red dashed line indicating the current time on the timeline.
 */
export const CurrentTimeIndicator = ({ currentTime, getLeftPos, containerWidth }) => {
  const leftPos = getLeftPos(currentTime) + SIDEBAR_WIDTH;

  // Only render if within visible bounds
  if (leftPos <= SIDEBAR_WIDTH || leftPos >= containerWidth) {
    return null;
  }

  return (
    <div
      className="absolute top-0 bottom-0 w-px border-l-2 border-red-400 border-dashed z-40 pointer-events-none opacity-60"
      style={{ left: leftPos }}
    />
  );
};
