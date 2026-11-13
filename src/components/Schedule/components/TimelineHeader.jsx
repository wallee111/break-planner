import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { SIDEBAR_WIDTH } from '../../../utils/constants';

/**
 * Header row for the timeline showing hour labels and sort controls.
 */
export const TimelineHeader = ({
  hours,
  hourWidth,
  startHour,
  sortByTime,
  onToggleSort
}) => {
  return (
    <div className="h-10 border-b border-slate-100 flex sticky left-0 w-full bg-slate-50/50">
      {/* Sidebar Header */}
      <div
        className="shrink-0 sticky left-0 bg-white z-10 border-r border-slate-100 flex items-center justify-between px-4 font-semibold text-slate-500 text-sm"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <span>Team Member</span>
        <button
          onClick={onToggleSort}
          className={`p-1 rounded hover:bg-slate-100 transition-colors ${
            sortByTime ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'
          }`}
          title="Sort by Start Time"
        >
          <ArrowUpDown className="w-3 h-3" />
        </button>
      </div>

      {/* Hour Labels */}
      <div className="relative flex-1 h-full">
        {hours.map(h => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-slate-100 text-xs text-slate-400 pl-1 pt-2 font-medium"
            style={{ left: (h - startHour) * hourWidth }}
          >
            {h % 24}:00
          </div>
        ))}
      </div>
    </div>
  );
};
