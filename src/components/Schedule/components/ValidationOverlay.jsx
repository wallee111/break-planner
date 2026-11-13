import React, { useMemo } from 'react';
import { parse } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { SIDEBAR_WIDTH } from '../../../utils/constants';

/**
 * Displays semi-transparent warning zones on the timeline where coverage issues exist.
 * Shows inline feedback so users can see problem areas at a glance.
 */
export const ValidationOverlay = ({
  validationErrors,
  startHour,
  hourWidth,
  height = '100%'
}) => {
  // Group consecutive errors into ranges for efficient rendering
  const errorRanges = useMemo(() => {
    if (!validationErrors || validationErrors.length === 0) return [];

    // Parse all error times and sort
    const sortedErrors = [...validationErrors]
      .map(err => ({
        ...err,
        minutes: (() => {
          const parsed = parse(err.time, 'HH:mm', new Date());
          return parsed.getHours() * 60 + parsed.getMinutes();
        })()
      }))
      .sort((a, b) => a.minutes - b.minutes);

    // Group consecutive 15-minute slots
    const ranges = [];
    let currentRange = null;

    sortedErrors.forEach(err => {
      if (!currentRange) {
        currentRange = {
          startMinutes: err.minutes,
          endMinutes: err.minutes + 15,
          errors: [err]
        };
      } else if (err.minutes <= currentRange.endMinutes) {
        // Consecutive or overlapping - extend the range
        currentRange.endMinutes = Math.max(currentRange.endMinutes, err.minutes + 15);
        currentRange.errors.push(err);
      } else {
        // Gap - start new range
        ranges.push(currentRange);
        currentRange = {
          startMinutes: err.minutes,
          endMinutes: err.minutes + 15,
          errors: [err]
        };
      }
    });

    if (currentRange) {
      ranges.push(currentRange);
    }

    return ranges;
  }, [validationErrors]);

  if (errorRanges.length === 0) return null;

  const startMinutes = startHour * 60;
  const pxPerMinute = hourWidth / 60;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5]"
      style={{ height, left: SIDEBAR_WIDTH }}
    >
      {errorRanges.map((range, idx) => {
        const left = (range.startMinutes - startMinutes) * pxPerMinute;
        const width = (range.endMinutes - range.startMinutes) * pxPerMinute;

        return (
          <div
            key={idx}
            className="absolute top-0 bottom-0 bg-red-500/10 border-l-2 border-red-400"
            style={{ left, width }}
            title={range.errors.map(e => `${e.time}: ${e.message}`).join('\n')}
          >
            {/* Warning icon at top of zone */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2">
              <div className="bg-red-100 rounded-full p-0.5 shadow-sm border border-red-200">
                <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
