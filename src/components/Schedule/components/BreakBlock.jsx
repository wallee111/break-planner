import React from 'react';
import { addMinutes, differenceInMinutes, format, parse, roundToNearestMinutes } from 'date-fns';
import { Trash2, Link, Unlink2 } from 'lucide-react';

const roundToNearest15 = (date) => roundToNearestMinutes(date, { nearestTo: 15, roundingMethod: 'round' });

/**
 * Formats a duration in minutes to a human-readable string (e.g., "1h 30m")
 */
const formatDuration = (minutes) => {
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  let parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (r > 0) parts.push(`${r}m`);
  return parts.join(' ');
};

/**
 * Gets timestamp from a date or string
 */
const getTime = (d) => {
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'string') return parse(d, 'HH:mm', new Date()).getTime();
  return 0;
};

/**
 * Individual break block component with drag, merge, and unlink functionality.
 */
export const BreakBlock = ({
  brk,
  empId,
  empSchedule,
  shiftStart,
  shiftEnd,
  minWidth,
  dragState,
  hoveredBreakId,
  isSelected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onUnlink,
  onMerge
}) => {
  const isDragging = dragState?.type === 'MOVE_BREAK' && dragState.breakId === brk.id;
  const isHovering = hoveredBreakId === brk.id;

  // Calculate visual position
  let visualLeft;
  let displayTime = '';

  if (isDragging) {
    const dX = dragState.currentX - dragState.initialX;
    const rawTime = addMinutes(dragState.originalStartTime, dX / minWidth);
    const snappedTime = roundToNearest15(rawTime);
    visualLeft = differenceInMinutes(snappedTime, shiftStart) * minWidth;
    displayTime = format(snappedTime, 'HH:mm');
  } else {
    visualLeft = differenceInMinutes(brk.startTime, shiftStart) * minWidth;
    displayTime = format(brk.startTime, 'HH:mm');
  }

  const width = brk.duration * minWidth;

  // Determine break color classes
  const getBreakClasses = () => {
    if (brk.type === 'merged') {
      return 'bg-indigo-50 border-2 border-dashed border-indigo-400 text-indigo-700 z-20';
    }
    if (brk.type === 'paid') {
      return 'bg-indigo-100 border-indigo-200 text-indigo-700';
    }
    // unpaid or meal
    return 'bg-orange-100 border-orange-200 text-orange-700';
  };

  // Render gap measurements and merge button during drag
  const renderDragOverlay = () => {
    if (!isDragging) return null;

    const dX = dragState.currentX - dragState.initialX;
    const snappedDeltaPx = Math.round(dX / (15 * minWidth)) * (15 * minWidth);
    const deltaMins = snappedDeltaPx / minWidth;

    const sTime = addMinutes(dragState.originalStartTime, deltaMins);
    const sEnd = addMinutes(sTime, brk.duration);

    // Find neighboring breaks
    const sortedOthers = [...empSchedule.breaks]
      .filter(b => b.id !== brk.id)
      .sort((a, b) => getTime(a.startTime) - getTime(b.startTime));

    let pEnd = shiftStart;
    let nStart = shiftEnd;
    let nextBreakObj = null;

    const currentStartMs = sTime.getTime();
    const currentEndMs = sEnd.getTime();

    for (let other of sortedOthers) {
      const oStart = other.startTime instanceof Date ? other.startTime : parse(other.startTime, 'HH:mm', new Date());
      const oEnd = other.endTime instanceof Date ? other.endTime : parse(other.endTime, 'HH:mm', new Date());

      if (oEnd.getTime() <= currentStartMs && oEnd.getTime() > pEnd.getTime()) {
        pEnd = oEnd;
      }
      if (oStart.getTime() >= currentEndMs && oStart.getTime() < nStart.getTime()) {
        nStart = oStart;
        nextBreakObj = other;
      }
    }

    const lGap = differenceInMinutes(sTime, pEnd);
    const rGap = differenceInMinutes(nStart, sEnd);
    const lgTx = formatDuration(lGap);
    const rgTx = formatDuration(rGap);

    // Check for merge opportunity
    let linkButton = null;
    if (nextBreakObj) {
      const rbTime = nextBreakObj.startTime instanceof Date
        ? nextBreakObj.startTime
        : parse(nextBreakObj.startTime, 'HH:mm', new Date());
      const lbEnd = sEnd;
      const gapMins = differenceInMinutes(rbTime, lbEnd);

      // Allow merge when breaks are close (within 30 minutes or slight overlap)
      if (gapMins <= 30 && gapMins >= -5) {
        const pxFromShiftStart = (differenceInMinutes(lbEnd, shiftStart) * minWidth) + (gapMins * minWidth) / 2;

        linkButton = (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMerge(empId, brk, nextBreakObj);
            }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 bg-white border border-indigo-200 rounded-full p-1 shadow-sm hover:scale-110 hover:border-indigo-500 transition-all group/link"
            style={{ left: pxFromShiftStart }}
            title="Merge with next break"
          >
            <Link className="w-3 h-3 text-indigo-400 group-hover/link:text-indigo-600" />
          </button>
        );
      }
    }

    return (
      <>
        {/* Merged type unlink button */}
        {brk.type === 'merged' && (
          <div className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnlink(empId, brk.id);
              }}
              className="bg-white/90 p-1 rounded-full text-slate-500 hover:text-red-500 hover:bg-white shadow-sm"
              title="Unlink merged breaks"
            >
              <Unlink2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Left gap measurement */}
        {lgTx && (
          <div
            className="absolute right-full top-0 bottom-0 flex items-center justify-center pointer-events-none"
            style={{ width: lGap * minWidth }}
          >
            <div className="w-full h-px bg-indigo-300 absolute top-1/2" />
            <span className="bg-white px-1 text-[10px] font-medium text-indigo-500 relative z-10">
              {lgTx}
            </span>
          </div>
        )}

        {/* Right gap measurement */}
        {rgTx && (
          <div
            className="absolute left-full top-0 bottom-0 flex items-center justify-center pointer-events-none"
            style={{ width: rGap * minWidth }}
          >
            <div className="w-full h-px bg-indigo-300 absolute top-1/2" />
            <span className="bg-white px-1 text-[10px] font-medium text-indigo-500 relative z-10">
              {rgTx}
            </span>
          </div>
        )}

        {linkButton}
      </>
    );
  };

  // Handle click to select (only if not starting a drag)
  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect();
    }
  };

  // Selection ring classes
  const selectionClasses = isSelected
    ? 'ring-2 ring-indigo-500 ring-offset-1'
    : '';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      className={`absolute top-1 bottom-1 rounded-md shadow-sm border flex items-center justify-center text-[10px] font-bold cursor-grab active:cursor-grabbing ${getBreakClasses()} ${selectionClasses}`}
      style={{
        left: visualLeft,
        width: width,
        transition: isDragging ? 'none' : 'all 0.2s ease',
        zIndex: (isDragging || isHovering || isSelected) ? 50 : 10
      }}
      title={`${brk.type} break${isSelected ? ' (Use ← → to move, Tab for next, Esc to deselect)' : ''}`}
    >
      {/* Unlink button for merged breaks (non-dragging) */}
      {isHovering && !isDragging && brk.type === 'merged' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnlink(empId, brk.id);
          }}
          className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-slate-200 z-[60] flex items-center justify-center w-5 h-5"
          title="Unlink Breaks"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Duration label */}
      {brk.duration}

      {/* Time tooltip on hover */}
      {isHovering && !isDragging && (
        <div className="absolute bottom-full left-0 flex flex-col items-center pb-1 -translate-x-1/2 pointer-events-none">
          <div className="bg-white text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-indigo-100 mb-0.5 whitespace-nowrap">
            {displayTime}
          </div>
          <div className="w-px h-8 bg-indigo-500" />
        </div>
      )}

      {/* Drag overlay with gap measurements */}
      {renderDragOverlay()}
    </div>
  );
};
