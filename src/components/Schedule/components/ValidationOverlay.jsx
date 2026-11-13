import React, { useMemo } from 'react';
import { parse } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { SIDEBAR_WIDTH } from '../../../utils/constants';

/**
 * Displays semi-transparent warning zones on the timeline where coverage issues exist.
 * Shows inline feedback so users can see problem areas at a glance.
 *   - red   = break conflict (breaks take coverage below a rule — fixable)
 *   - amber = staffing gap (too few people scheduled — from the shift schedule)
 */
const KIND_STYLES = {
  break: { zone: 'bg-red-500/10 border-l-2 border-red-400', badge: 'bg-red-100 border-red-200', icon: 'text-red-500' },
  staffing: { zone: 'bg-amber-400/10 border-l-2 border-amber-300 border-dashed', badge: 'bg-amber-50 border-amber-200', icon: 'text-amber-500' }
};

// Group consecutive 15-minute slots of ONE kind into ranges
const groupRanges = (errors) => {
  const sorted = errors
    .map(err => {
      const parsed = parse(err.time, 'HH:mm', new Date());
      return { ...err, minutes: parsed.getHours() * 60 + parsed.getMinutes() };
    })
    .sort((a, b) => a.minutes - b.minutes);

  const ranges = [];
  let current = null;
  for (const err of sorted) {
    if (current && err.minutes <= current.endMinutes) {
      current.endMinutes = Math.max(current.endMinutes, err.minutes + 15);
      current.errors.push(err);
    } else {
      if (current) ranges.push(current);
      current = { startMinutes: err.minutes, endMinutes: err.minutes + 15, errors: [err] };
    }
  }
  if (current) ranges.push(current);
  return ranges;
};

export const ValidationOverlay = ({
  validationErrors,
  startHour,
  hourWidth,
  height = '100%'
}) => {
  const errorRanges = useMemo(() => {
    if (!validationErrors || validationErrors.length === 0) return [];
    // Staffing first so break-conflict zones paint on top where they overlap
    return ['staffing', 'break'].flatMap(kind =>
      groupRanges(validationErrors.filter(e => (e.kind || 'break') === kind)).map(r => ({ ...r, kind }))
    );
  }, [validationErrors]);

  if (errorRanges.length === 0) return null;

  const startMinutes = startHour * 60;
  const pxPerMinute = hourWidth / 60;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5]"
      style={{ height, left: SIDEBAR_WIDTH }}
    >
      {errorRanges.map((range) => {
        const left = (range.startMinutes - startMinutes) * pxPerMinute;
        const width = (range.endMinutes - range.startMinutes) * pxPerMinute;
        const style = KIND_STYLES[range.kind] || KIND_STYLES.break;

        return (
          <div
            key={`${range.kind}-${range.startMinutes}`}
            className={`absolute top-0 bottom-0 ${style.zone}`}
            style={{ left, width }}
            title={range.errors.map(e => `${e.time}: ${e.message}`).join('\n')}
          >
            {/* Warning icon at top of zone */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2">
              <div className={`rounded-full p-0.5 shadow-sm border ${style.badge}`}>
                <AlertTriangle className={`w-2.5 h-2.5 ${style.icon}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
