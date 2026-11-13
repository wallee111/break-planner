import React from 'react';
import { parse, addMinutes, differenceInMinutes, format } from 'date-fns';
import { Trash2, RotateCw } from 'lucide-react';
import { BreakBlock } from './BreakBlock';
import { SIDEBAR_WIDTH } from '../../../utils/constants';

/**
 * Converts hex color to rgba with alpha
 */
const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(99, 102, 241, ${alpha})`;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Single employee row in the timeline view.
 */
export const TimelineRow = ({
  emp,
  empSchedule,
  schedule,
  hours,
  hourWidth,
  minWidth,
  startHour,
  endHour,
  dragState,
  hoveredBreakId,
  swapCandidate,
  availableEmployees,
  roleColors,
  getLeftPos,
  onRemoveEmployee,
  onSwapCandidate,
  onSwapEmployee,
  onCreateMouseDown,
  onShiftMoveStart,
  onShiftResizeStart,
  onBreakMouseDown,
  onHoverBreak,
  onLeaveBreak,
  onUnlinkBreak,
  onMergeBreaks,
  selectedBreak,
  onSelectBreak
}) => {
  // Parse and validate shift times
  let shiftStart = emp.startTime ? parse(emp.startTime, 'HH:mm', new Date()) : null;
  let shiftEnd = emp.endTime ? parse(emp.endTime, 'HH:mm', new Date()) : null;

  const isValidShift = shiftStart && shiftEnd && !isNaN(shiftStart.getTime()) && !isNaN(shiftEnd.getTime());

  if (!isValidShift) {
    shiftStart = null;
    shiftEnd = null;
  } else if (shiftEnd < shiftStart) {
    shiftEnd = addMinutes(shiftEnd, 24 * 60);
  }

  // Calculate visual positions with drag adjustments
  let visualStart = shiftStart;
  let visualEnd = shiftEnd;

  if (isValidShift && dragState && dragState.empId === emp.id) {
    const minWidthVal = dragState.minWidth || minWidth;

    if (dragState.type === 'MOVE_SHIFT') {
      const diffPx = dragState.currentX - dragState.startX;
      const diffMins = Math.round((diffPx / minWidthVal) / 15) * 15;
      visualStart = addMinutes(dragState.originalStart, diffMins);
      visualEnd = addMinutes(dragState.originalEnd, diffMins);
    } else if (dragState.type === 'RESIZE_START') {
      const diffPx = dragState.currentX - dragState.startX;
      const diffMins = Math.round((diffPx / minWidthVal) / 15) * 15;
      visualStart = addMinutes(dragState.originalStart, diffMins);
    } else if (dragState.type === 'RESIZE_END') {
      const diffPx = dragState.currentX - dragState.startX;
      const diffMins = Math.round((diffPx / minWidthVal) / 15) * 15;
      visualEnd = addMinutes(dragState.originalEnd, diffMins);
    }
  }

  // Render calculations
  const startLeft = (visualStart && !isNaN(visualStart.getTime())) ? getLeftPos(visualStart) : 0;
  const durationMins = (visualStart && visualEnd && !isNaN(visualStart.getTime()) && !isNaN(visualEnd.getTime()))
    ? differenceInMinutes(visualEnd, visualStart)
    : 0;
  const width = (durationMins / 60) * hourWidth;
  const durationHrs = Math.round((durationMins / 60) * 100) / 100;
  const roleColor = roleColors?.[emp.roles[0]] || '#f1f5f9';
  const hasShift = empSchedule && emp.startTime && emp.endTime;

  return (
    <div className="flex h-16 border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative hover:z-30">
      {/* Sidebar */}
      <div
        className="shrink-0 sticky left-0 bg-white z-10 border-r border-slate-100 p-3 flex flex-col justify-center shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] group/idx"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div className="flex justify-between items-start">
          <div className="relative overflow-visible">
            {/* Employee Name with Swap */}
            <div
              className="font-medium text-slate-800 text-sm truncate cursor-pointer hover:text-indigo-600 flex items-center gap-1 group/name"
              onClick={(e) => {
                e.stopPropagation();
                onSwapCandidate(swapCandidate === emp.id ? null : emp.id);
              }}
              title="Click to swap employee"
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-200"
                style={{ backgroundColor: emp.avatarColor || '#e2e8f0' }}
              />
              {emp.name}
              <RotateCw className="w-3 h-3 opacity-0 group-hover/name:opacity-100 transition-opacity text-slate-400" />
            </div>

            {/* Swap Popover */}
            {swapCandidate === emp.id && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-[100] overflow-hidden animate-in fade-in zoom-in-95">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                  Swap with...
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {availableEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">No available employees</div>
                  ) : (
                    availableEmployees.map(r => (
                      <button
                        key={r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwapEmployee(r.id);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between"
                      >
                        {r.name}
                        <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-1 rounded">
                          {r.defaultRole}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Role badges and duration */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {emp.roles.map((role, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: hexToRgba(roleColors?.[role] || '#6366f1', 0.15),
                    color: roleColors?.[role] || '#6366f1',
                    border: `1px solid ${hexToRgba(roleColors?.[role] || '#6366f1', 0.2)}`
                  }}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight"
                >
                  {role}
                </span>
              ))}
              {hasShift && (
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-1">
                  {durationHrs}h
                </span>
              )}
            </div>
          </div>

          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveEmployee(emp.id);
            }}
            className="opacity-0 group-hover/idx:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Timeline Interactive Area */}
      <div
        className="relative flex-1 h-full cursor-crosshair"
        onMouseDown={(e) => onCreateMouseDown(e, emp.id, empSchedule)}
      >
        {/* Grid Lines */}
        {hours.map(h => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-slate-100 pointer-events-none"
            style={{ left: (h - startHour) * hourWidth }}
          />
        ))}

        {/* Ghost (Creation Preview) */}
        {dragState?.type === 'CREATE_SHIFT' && dragState.empId === emp.id && (
          <div
            className="absolute top-3 bottom-3 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50 opacity-70 pointer-events-none z-20 flex items-center justify-center text-xs font-bold text-indigo-500"
            style={{
              left: getLeftPos(dragState.startTime),
              width: (differenceInMinutes(dragState.tempEndTime, dragState.startTime) / 60) * hourWidth
            }}
          >
            {format(dragState.startTime, 'HH:mm')} - {format(dragState.tempEndTime, 'HH:mm')} ({Math.round(differenceInMinutes(dragState.tempEndTime, dragState.startTime) / 60 * 100) / 100}h)
          </div>
        )}

        {/* Shift Block */}
        {empSchedule && width > 0 && (
          <div
            className="absolute top-3 bottom-3 rounded-lg opacity-90 group/shift"
            style={{
              left: startLeft,
              width: width,
              backgroundColor: roleColor,
              border: '1px solid ' + roleColor,
              cursor: 'move'
            }}
            onMouseDown={(e) => onShiftMoveStart(e, emp.id, shiftStart, shiftEnd)}
          >
            {/* Resize Handles */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-20 hover:bg-black/10 transition-colors rounded-l-lg"
              onMouseDown={(e) => onShiftResizeStart(e, emp.id, 'START', shiftStart, shiftEnd)}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-20 hover:bg-black/10 transition-colors rounded-r-lg"
              onMouseDown={(e) => onShiftResizeStart(e, emp.id, 'END', shiftStart, shiftEnd)}
            />

            {/* Shift Details Tooltip */}
            <div className={`${dragState ? 'hidden' : 'hidden group-hover/shift:block'} absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg z-50 w-max pointer-events-none`}>
              <div className="font-bold border-b border-slate-600 pb-1 mb-1 text-center">
                {emp.startTime} - {emp.endTime}
              </div>
              {empSchedule.breaks.length === 0 ? (
                <div className="text-slate-400 italic">No breaks</div>
              ) : (
                empSchedule.breaks.map((b, idx) => (
                  <div key={b.id || idx} className="flex justify-between gap-3">
                    <span className={b.type === 'meal' ? 'text-indigo-300' : 'text-orange-200'}>
                      {b.type === 'meal' ? 'Meal' : 'Rest'} ({b.duration}m)
                    </span>
                    <span className="font-mono">
                      {format(b.startTime, 'HH:mm')} - {format(b.endTime, 'HH:mm')}
                    </span>
                  </div>
                ))
              )}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
            </div>

            {/* Break Blocks */}
            {empSchedule?.breaks.map(brk => (
              <BreakBlock
                key={brk.id}
                brk={brk}
                empId={emp.id}
                empSchedule={empSchedule}
                shiftStart={shiftStart}
                shiftEnd={shiftEnd}
                minWidth={minWidth}
                dragState={dragState}
                hoveredBreakId={hoveredBreakId}
                isSelected={selectedBreak?.empId === emp.id && selectedBreak?.breakId === brk.id}
                onSelect={() => onSelectBreak({ empId: emp.id, breakId: brk.id })}
                onMouseEnter={() => onHoverBreak(brk.id)}
                onMouseLeave={() => onLeaveBreak()}
                onMouseDown={(e) => onBreakMouseDown(e, brk, emp.id)}
                onUnlink={onUnlinkBreak}
                onMerge={onMergeBreaks}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
