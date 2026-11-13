import React from 'react';
import { addMinutes, format, roundToNearestMinutes } from 'date-fns';
import { SIDEBAR_WIDTH } from '../../../utils/constants';

const roundToNearest15 = (date) => roundToNearestMinutes(date, { nearestTo: 15, roundingMethod: 'round' });

/**
 * Displays a vertical guide line showing the snapped time position during break dragging.
 */
export const BreakGuideLine = ({ dragState, minWidth, getLeftPos }) => {
  if (dragState?.type !== 'MOVE_BREAK') {
    return null;
  }

  const dX = dragState.currentX - dragState.initialX;
  const rawTime = addMinutes(dragState.originalStartTime, dX / minWidth);
  const snappedTime = roundToNearest15(rawTime);
  const leftPos = getLeftPos(snappedTime) + SIDEBAR_WIDTH;

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-indigo-600 z-50 pointer-events-none"
      style={{ left: leftPos }}
    >
      <div className="absolute top-0 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-b font-bold">
        {format(snappedTime, 'HH:mm')}
      </div>
    </div>
  );
};
