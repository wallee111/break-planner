import React, { useState, useRef, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Button } from '../ui/Button';
import { parse, format, addMinutes, differenceInMinutes } from 'date-fns';
import { Play, RotateCw, AlertTriangle, CheckCircle } from 'lucide-react';

const HOUR_WIDTH = 60; // px
const MIN_WIDTH = HOUR_WIDTH / 60;

export const TimelineView = () => {
  const { employees, schedule, generateSchedule, updateSchedule, validationErrors, roleColors, activityLog, validateNow } = usePlanner();

  // DnD State
  const [dragState, setDragState] = useState(null); // { breakId, empId, initialX, currentX, startUserTime }
  const containerRef = useRef(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleValidate = () => {
    const isValid = validateNow();
    if (isValid) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  // Determine view range
  const startHour = 8;
  const endHour = 20;
  const totalHours = endHour - startHour;

  const getLeftPos = (timeStr) => {
    let date = typeof timeStr === 'string' ? parse(timeStr, 'HH:mm', new Date()) : timeStr;
    const hours = date.getHours() + date.getMinutes() / 60;
    return (hours - startHour) * HOUR_WIDTH;
  };

  const handleMouseDown = (e, brk, empId) => {
    e.preventDefault();
    e.stopPropagation();

    setDragState({
      breakId: brk.id,
      empId: empId,
      initialX: e.clientX,
      currentX: e.clientX,
      originalStartTime: brk.startTime,
      duration: brk.duration,
      type: brk.type
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;
      setDragState(prev => ({ ...prev, currentX: e.clientX }));
    };

    const handleMouseUp = (e) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.initialX;
      // Snap to 15 mins
      // 15 mins = 15 * MIN_WIDTH pixels
      const SNAP_PX = 15 * MIN_WIDTH;
      const snappedDeltaPx = Math.round(deltaX / SNAP_PX) * SNAP_PX;
      const deltaMinutes = (snappedDeltaPx / MIN_WIDTH);

      if (deltaMinutes !== 0) {
        const newStartTime = addMinutes(dragState.originalStartTime, deltaMinutes);
        const newEndTime = addMinutes(newStartTime, dragState.duration);

        // Find the employee schedule
        const empScheduleIndex = schedule.findIndex(s => s.employeeId === dragState.empId);
        if (empScheduleIndex === -1) {
          setDragState(null);
          return;
        }

        const newSchedule = [...schedule];
        const empBreaks = [...newSchedule[empScheduleIndex].breaks];

        // Check for Swap
        // Find if we dropped ON TOP of another break
        // Simple logic: if new interval overlaps significantly with another
        // actually, let's just use the visual drop target. 
        // Iterate other breaks to see if we satisfy a swap condition
        const swapTargetIndex = empBreaks.findIndex(b =>
          b.id !== dragState.breakId &&
          newStartTime < b.endTime && newEndTime > b.startTime // Overlap
          // Could refine swap trigger (e.g. >50% overlap)
        );

        const activeBreakIndex = empBreaks.findIndex(b => b.id === dragState.breakId);

        if (swapTargetIndex !== -1) {
          // SWAP
          const target = empBreaks[swapTargetIndex];

          // Swap start times, keep durations
          const targetStartTime = target.startTime;

          empBreaks[activeBreakIndex] = {
            ...empBreaks[activeBreakIndex],
            startTime: targetStartTime,
            endTime: addMinutes(targetStartTime, dragState.duration)
          };

          empBreaks[swapTargetIndex] = {
            ...empBreaks[swapTargetIndex],
            startTime: dragState.originalStartTime, // Swap to the original position of the dragged item
            endTime: addMinutes(dragState.originalStartTime, target.duration)
          };

        } else {
          // MOVE
          empBreaks[activeBreakIndex] = {
            ...empBreaks[activeBreakIndex],
            startTime: newStartTime,
            endTime: newEndTime
          };
        }

        // Sort breaks
        empBreaks.sort((a, b) => a.startTime - b.startTime);

        newSchedule[empScheduleIndex] = {
          ...newSchedule[empScheduleIndex],
          breaks: empBreaks
        };

        updateSchedule(newSchedule, swapTargetIndex !== -1 ? 'Swapped Breaks' : 'Moved Break');
      }

      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, schedule, updateSchedule]);

  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  return (
    <div className="space-y-6 select-none" ref={containerRef}>
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          {showSuccess && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm border border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">Schedule is Valid!</span>
            </div>
          )}
          {validationErrors.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-sm border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold">{validationErrors.length} Issues Found</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleValidate} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <CheckCircle className="w-4 h-4" />
            Validate
          </Button>
          <Button onClick={generateSchedule}>
            {schedule.length > 0 ? <RotateCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {schedule.length > 0 ? 'Regenerate Schedule' : 'Generate Schedule'}
          </Button>
        </div>
      </div>

      {schedule.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto pb-6">
          {/* Timeline Header */}
          <div className="h-10 border-b border-slate-100 flex sticky left-0 min-w-max">
            <div className="w-48 shrink-0 sticky left-0 bg-white z-10 border-r border-slate-100"></div>
            <div className="relative flex-1 h-full" style={{ width: totalHours * HOUR_WIDTH }}>
              {hours.map(h => (
                <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100 text-xs text-slate-400 pl-1 pt-2 font-medium" style={{ left: (h - startHour) * HOUR_WIDTH }}>
                  {h}:00
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="min-w-max">
            {employees.map(emp => {
              const empSchedule = schedule.find(s => s.employeeId === emp.id);
              const shiftStart = parse(emp.startTime, 'HH:mm', new Date());
              const shiftEnd = parse(emp.endTime, 'HH:mm', new Date());
              const shiftLeft = getLeftPos(shiftStart);
              const shiftWidth = (differenceInMinutes(shiftEnd, shiftStart) / 60) * HOUR_WIDTH;

              // Get role color
              const primaryRole = emp.roles[0];
              const roleColor = roleColors?.[primaryRole] || '#f1f5f9'; // Default slate-100

              return (
                <div key={emp.id} className="flex h-16 border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <div className="w-48 shrink-0 sticky left-0 bg-white z-10 border-r border-slate-100 p-3 flex flex-col justify-center shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                    <div className="font-medium text-slate-800 text-sm truncate">{emp.name}</div>
                    <div className="text-xs text-slate-500 truncate">{emp.roles.join(', ')}</div>
                  </div>

                  <div className="relative flex-1 h-full" style={{ width: totalHours * HOUR_WIDTH }}>
                    {/* Grid lines */}
                    {hours.map(h => (
                      <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: (h - startHour) * HOUR_WIDTH }}></div>
                    ))}

                    {/* Shift Container */}
                    <div
                      className="absolute top-3 bottom-3 rounded-lg opacity-80"
                      style={{
                        left: shiftLeft,
                        width: shiftWidth,
                        backgroundColor: roleColor,
                        border: '1px solid ' + roleColor
                      }}
                    >
                      {/* Breaks */}
                      {empSchedule?.breaks.map(brk => {
                        const isDragging = dragState?.breakId === brk.id;

                        // Visual position logic
                        let visualLeft;

                        if (isDragging) {
                          // Calculate visual delta
                          const dX = dragState.currentX - dragState.initialX;
                          const originalLeft = (differenceInMinutes(dragState.originalStartTime, shiftStart) * MIN_WIDTH);
                          visualLeft = originalLeft + dX;
                        } else {
                          visualLeft = (differenceInMinutes(brk.startTime, shiftStart) * MIN_WIDTH);
                        }

                        const width = brk.duration * MIN_WIDTH;

                        return (
                          <div
                            key={brk.id}
                            onMouseDown={(e) => handleMouseDown(e, brk, emp.id)}
                            className={`absolute top-1 bottom-1 rounded-md shadow-sm border flex items-center justify-center text-[10px] font-bold tracking-tight cursor-move transition-all
                                  ${brk.type === 'paid' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-orange-100 border-orange-200 text-orange-700'}
                                  ${isDragging ? 'z-50 shadow-lg scale-105 opacity-90 ring-2 ring-indigo-400' : 'hover:brightness-95'}
                                `}
                            style={{
                              left: visualLeft,
                              width: width,
                              // Disable transition during drag for smoothness
                              transition: isDragging ? 'none' : 'all 0.2s ease'
                            }}
                            title={`${brk.type} break: ${format(brk.startTime, 'HH:mm')} - ${format(brk.endTime, 'HH:mm')}`}
                          >
                            {brk.duration}
                            {isDragging && (() => {
                              const dX = dragState.currentX - dragState.initialX;
                              const SNAP_PX = 15 * MIN_WIDTH;
                              const snappedDeltaPx = Math.round(dX / SNAP_PX) * SNAP_PX;
                              const deltaMinutes = (snappedDeltaPx / MIN_WIDTH);
                              const draggedTime = addMinutes(dragState.originalStartTime, deltaMinutes);
                              const draggedEnd = addMinutes(draggedTime, brk.duration);

                              // Neighbor Logic
                              const otherBreaks = empSchedule?.breaks.filter(b => b.id !== brk.id) || [];

                              // 1. Find Left Boundary (nearest break end OR shift start)
                              let leftBound = shiftStart;
                              otherBreaks.forEach(b => {
                                const end = addMinutes(b.startTime, b.duration);
                                if (end <= draggedTime && end > leftBound) {
                                  leftBound = end;
                                }
                              });

                              // 2. Find Right Boundary (nearest break start OR shift end)
                              let rightBound = shiftEnd;
                              otherBreaks.forEach(b => {
                                if (b.startTime >= draggedEnd && b.startTime < rightBound) {
                                  rightBound = b.startTime;
                                }
                              });

                              // Calculate Dimensions
                              const leftGapMins = differenceInMinutes(draggedTime, leftBound);
                              const rightGapMins = differenceInMinutes(rightBound, draggedEnd);

                              // Helper to format time
                              const fmtDur = (m) => {
                                const h = Math.floor(m / 60);
                                const mn = m % 60;
                                return h > 0 ? `${h}h ${mn}m` : `${mn}m`;
                              };

                              return (
                                <>
                                  {/* Main Tooltip (Start Time Only) */}
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none font-bold">
                                    {format(draggedTime, 'HH:mm')}
                                  </div>

                                  {/* Left Dimension Line */}
                                  {leftGapMins > 0 && (
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 h-px bg-indigo-500 border-t border-dashed border-indigo-400 flex items-center justify-center -z-10"
                                      style={{
                                        right: '100%', // Attach to left edge of dragged block
                                        width: leftGapMins * MIN_WIDTH,
                                        marginRight: 0
                                      }}
                                    >
                                      {/* Ticks */}
                                      <div className="absolute left-0 h-3 w-px bg-indigo-500 top-1/2 -translate-y-1/2"></div>
                                      <div className="absolute right-0 h-3 w-px bg-indigo-500 top-1/2 -translate-y-1/2"></div>

                                      {/* Label */}
                                      <div className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full border border-indigo-200 font-medium translate-y-[-10px]">
                                        {fmtDur(leftGapMins)}
                                      </div>
                                    </div>
                                  )}

                                  {/* Right Dimension Line */}
                                  {rightGapMins > 0 && (
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 h-px bg-indigo-500 border-t border-dashed border-indigo-400 flex items-center justify-center -z-10"
                                      style={{
                                        left: '100%', // Attach to right edge of dragged block
                                        width: rightGapMins * MIN_WIDTH,
                                        marginLeft: 0
                                      }}
                                    >
                                      {/* Ticks */}
                                      <div className="absolute left-0 h-3 w-px bg-indigo-500 top-1/2 -translate-y-1/2"></div>
                                      <div className="absolute right-0 h-3 w-px bg-indigo-500 top-1/2 -translate-y-1/2"></div>

                                      {/* Label */}
                                      <div className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full border border-indigo-200 font-medium translate-y-[-10px]">
                                        {fmtDur(rightGapMins)}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Conflicts Feed */}
        {validationErrors.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex flex-col max-h-60">
            <div className="p-3 border-b border-amber-200 bg-amber-100/50 rounded-t-xl sticky top-0 flex items-center justify-between">
              <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Schedule Conflicts
              </h3>
              <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{validationErrors.length}</span>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {validationErrors.map((err, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-amber-700 bg-white/50 p-2 rounded">
                  <span className="font-mono bg-amber-100 px-1 rounded h-fit text-xs font-bold">{err.time}</span>
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-60">
          <div className="p-3 border-b border-slate-200 bg-slate-100/50 rounded-t-xl sticky top-0">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              Activity Log
            </h3>
          </div>
          <div className="overflow-y-auto p-4 space-y-2">
            {activityLog.length === 0 && <div className="text-sm text-slate-400 italic">No activity yet.</div>}
            {activityLog.map((log) => (
              <div key={log.id} className="text-sm border-l-2 pl-2 py-0.5 border-indigo-300">
                <span className="text-xs text-slate-400 block">{log.timestamp.toLocaleTimeString()}</span>
                <span className={`text-slate-700 ${log.type === 'warning' ? 'text-amber-600 font-medium' : ''}`}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
