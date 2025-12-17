import React, { useState, useRef, useEffect, useMemo } from 'react';
import { calculateBreaks } from '../../utils/scheduler';
import { usePlanner } from '../../context/PlannerContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { parse, format, addMinutes, differenceInMinutes, setHours, setMinutes, startOfDay, roundToNearestMinutes } from 'date-fns';
import { Play, RotateCw, AlertTriangle, CheckCircle, Plus, Trash2, GripVertical, ArrowUpDown, Link, Unlink2 } from 'lucide-react';
import { LaborChart } from './LaborChart';

const roundToNearest15 = (date) => roundToNearestMinutes(date, { nearestTo: 15, roundingMethod: 'round' });

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

export const TimelineView = () => {
  // ... existing hooks ...

  const handleMergeBreaks = (empId, break1, break2) => {
    const currentSchedule = scheduleRef.current;
    const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === empId);
    if (empScheduleIndex === -1) return;

    const newSchedule = [...currentSchedule];
    const empBreaks = [...newSchedule[empScheduleIndex].breaks];

    const getTime = (d) => (d instanceof Date ? d : parse(d, 'HH:mm', new Date())).getTime();

    // Create Merged Break
    // Flatten subBreaks if they exist to avoid nesting merged inside merged
    const parts = [
      ...(break1.subBreaks || [break1]),
      ...(break2.subBreaks || [break2])
    ].sort((a, b) => getTime(a.startTime) - getTime(b.startTime));

    const newStart = parts[0].startTime;
    const totalDuration = parts.reduce((acc, b) => acc + b.duration, 0);
    const startObj = newStart instanceof Date ? newStart : parse(newStart, 'HH:mm', new Date());
    const newEnd = addMinutes(startObj, totalDuration);

    const mergedBreak = {
      id: `merged-${Date.now()}`,
      type: 'merged',
      startTime: newStart,
      endTime: format(newEnd, 'HH:mm'),
      duration: totalDuration,
      subBreaks: parts
    };

    // Remove originals and add new
    const updatedBreaks = empBreaks.filter(b => b.id !== break1.id && b.id !== break2.id);
    updatedBreaks.push(mergedBreak);
    updatedBreaks.sort((a, b) => getTime(a.startTime) - getTime(b.startTime));

    newSchedule[empScheduleIndex].breaks = updatedBreaks;
    updateSchedule(newSchedule, 'Merged Breaks');
  };
  const { employees, schedule, generateSchedule, updateSchedule, validationErrors, roleColors, activityLog, validateNow, removeEmployee, addEmployee, roster, updateEmployee, rules, coverageRules, viewRange, updateViewRange } = usePlanner();

  const confirmMerge = () => {
    if (!mergeCandidate) return;
    const { empId, draggedBreak, targetBreak, totalDuration } = mergeCandidate;

    const currentSchedule = scheduleRef.current;
    const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === empId);

    if (empScheduleIndex === -1) {
      setMergeCandidate(null);
      return;
    }

    const newSchedule = [...currentSchedule];
    const empBreaks = [...newSchedule[empScheduleIndex].breaks];

    const getTime = (d) => (d instanceof Date ? d : parse(d, 'HH:mm', new Date())).getTime();

    // Sort parts to ensure chronological order regardless of drag direction
    const parts = [draggedBreak, targetBreak].sort((a, b) => getTime(a.startTime) - getTime(b.startTime));
    const newBreakStart = parts[0].startTime;

    // Determine End Time
    const startObj = newBreakStart instanceof Date ? newBreakStart : parse(newBreakStart, 'HH:mm', new Date());
    const newEndTime = addMinutes(startObj, totalDuration);

    const mergedBreak = {
      id: `merged-${Date.now()}`,
      type: 'merged',
      startTime: newBreakStart,
      endTime: format(newEndTime, 'HH:mm'), // Standardize to string if possible, or keep consistent? Context uses mixed. Let's keep strict.
      // Wait, updateSchedule expects specific format? 
      // Existing `calculateBreaks` returns Strings usually. 
      // Let's ensure consistency. If `newBreakStart` is string, keep it.
      // `endTime` should probably be formatted if start is string.
      // Actually, let's look at `TimelineView` usage. It seems to handle both.
      // Safest is to keep what `updateEmployee` does.
      duration: totalDuration,
      subBreaks: parts
    };

    // Ideally we ensure startTime is formatted if it was string
    if (typeof newBreakStart === 'string') {
      mergedBreak.endTime = format(newEndTime, 'HH:mm');
    } else {
      mergedBreak.endTime = newEndTime;
    }

    const updatedBreaks = empBreaks.filter(b => b.id !== draggedBreak.id && b.id !== targetBreak.id);
    updatedBreaks.push(mergedBreak);
    updatedBreaks.sort((a, b) => getTime(a.startTime) - getTime(b.startTime));

    newSchedule[empScheduleIndex].breaks = updatedBreaks;
    updateSchedule(newSchedule, 'Merged Breaks');
    setMergeCandidate(null);
  };

  const unlinkBreak = (empId, breakId) => {
    const currentSchedule = scheduleRef.current;
    const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === empId);

    if (empScheduleIndex === -1) return;

    const newSchedule = [...currentSchedule];
    const empBreaks = [...newSchedule[empScheduleIndex].breaks];
    const targetIdx = empBreaks.findIndex(b => b.id === breakId);

    if (targetIdx !== -1) {
      const mergedBreak = empBreaks[targetIdx];
      if (mergedBreak.subBreaks && mergedBreak.subBreaks.length > 0) {
        empBreaks.splice(targetIdx, 1);
        empBreaks.push(...mergedBreak.subBreaks);

        const getTime = (d) => (d instanceof Date ? d : parse(d, 'HH:mm', new Date())).getTime();
        empBreaks.sort((a, b) => getTime(a.startTime) - getTime(b.startTime));

        newSchedule[empScheduleIndex].breaks = empBreaks;
        updateSchedule(newSchedule, 'Unlinked Break');
      }
    }
  };

  const handleSwapEmployee = (newId) => {
    if (!swapCandidate) return;
    const oldId = swapCandidate;
    const newEmp = roster.find(r => r.id === newId);
    if (!newEmp) return;

    // Use Update to "morph" the employee record.
    // This preserves the DB ID and Schedule ID, avoiding race conditions and errors.
    const newRole = newEmp.defaultRole || (newEmp.roles && newEmp.roles[0]) || 'Staff';

    updateEmployee(oldId, {
      name: newEmp.name,
      roles: [newRole],
      defaultRole: newRole
    });

    setSwapCandidate(null);
  };

  // --- Crosshair State ---
  const [crosshairX, setCrosshairX] = useState(null);

  const handleContainerMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const SIDEBAR_WIDTH = 192;

    if (x > SIDEBAR_WIDTH) {
      setCrosshairX(x);
    } else {
      setCrosshairX(null);
    }
  };

  const handleContainerMouseLeave = () => {
    setCrosshairX(null);
  };

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [hoveredBreakId, setHoveredBreakId] = useState(null);
  const [sortByTime, setSortByTime] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mergeCandidate, setMergeCandidate] = useState(null);
  const [swapCandidate, setSwapCandidate] = useState(null);
  const addMenuRef = useRef(null);
  const swapTimeoutRef = useRef(null);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Create sorted list for display
  const displayedEmployees = useMemo(() => {
    if (!sortByTime) return employees;
    return [...employees].sort((a, b) => {
      // Parse times (handle missing checks inside parse or robust fallback)
      if (!a.startTime) return 1; // Push empty to bottom
      if (!b.startTime) return -1;
      const tA = parse(a.startTime, 'HH:mm', new Date());
      const tB = parse(b.startTime, 'HH:mm', new Date());
      return tA - tB;
    });
  }, [employees, sortByTime]);

  const sortedEmployees = displayedEmployees; // For semantic clarity downward

  // --- Dynamic Layout State ---
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1000); // Default safe width
  const SIDEBAR_WIDTH = 192; // w-48 = 12rem = 192px

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    // Initial measure
    updateWidth();

    // Resize Observer
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Determine view range
  // const [viewRange, setViewRange] = useState({ start: 8, end: 20 }); // Moved to Context for persistence



  const startHour = viewRange.start;
  const endHour = viewRange.end;
  const totalHours = Math.max(1, endHour - startHour);

  // --- Dynamic Metrics ---
  // Ensure we don't divide by zero or have negative width
  const timelineWidth = Math.max(100, containerWidth - SIDEBAR_WIDTH);
  const hourWidth = timelineWidth / totalHours;
  const minWidth = hourWidth / 60; // px per minute

  const getLeftPos = (timeStr) => {
    let date = typeof timeStr === 'string' ? parse(timeStr, 'HH:mm', new Date()) : timeStr;
    const hours = date.getHours() + date.getMinutes() / 60;
    // Handle overnight logic for display position?
    // If 'hours' is small (e.g. 1AM) but startHour is 8AM, it likely means next day (25).
    // Simple heuristic: if h < startHour, add 24.
    let h = hours;
    if (h < startHour) h += 24;

    return (h - startHour) * hourWidth;
  };

  // --- Handlers & DnD (Updated with minWidth) ---
  const [dragState, setDragState] = useState(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableEmployees = roster.filter(r => !employees.some(e => e.name === r.name));
  const [showSuccess, setShowSuccess] = useState(false);

  const handleValidate = () => {
    if (validateNow()) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleCreateMouseDown = (e, empId, existingSchedule) => {
    if (existingSchedule) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const clickMinutes = (relativeX / minWidth);
    const startTime = addMinutes(setHours(setMinutes(new Date(), 0), startHour), clickMinutes);
    let snappedStart = new Date(Math.round(startTime.getTime() / (15 * 60000)) * (15 * 60000));

    // Boundaries
    const minDate = setHours(setMinutes(startOfDay(new Date()), 0), startHour);
    const maxDate = setHours(setMinutes(startOfDay(new Date()), 0), endHour);

    if (snappedStart < minDate) snappedStart = minDate;
    if (snappedStart >= maxDate) snappedStart = addMinutes(maxDate, -15); // Ensure at least 15m slot

    setDragState({
      type: 'CREATE_SHIFT',
      empId,
      startX: e.clientX,
      currentX: e.clientX,
      startTime: snappedStart,
      tempEndTime: addMinutes(snappedStart, 60)
    });
  };

  const handleBreakMouseDown = (e, brk, empId) => {
    e.preventDefault(); e.stopPropagation();
    setDragState({
      type: 'MOVE_BREAK',
      breakId: brk.id,
      empId,
      initialX: e.clientX,
      currentX: e.clientX,
      originalStartTime: brk.startTime,
      duration: brk.duration
    });
  };

  const handleShiftMoveStart = (e, empId, start, end) => {
    e.preventDefault(); e.stopPropagation();
    setDragState({
      type: 'MOVE_SHIFT',
      empId,
      startX: e.clientX,
      currentX: e.clientX,
      originalStart: start,
      originalEnd: end
    });
  };

  const handleShiftResizeStart = (e, empId, edge, start, end) => {
    e.preventDefault(); e.stopPropagation();
    setDragState({
      type: edge === 'START' ? 'RESIZE_START' : 'RESIZE_END',
      empId,
      startX: e.clientX,
      currentX: e.clientX,
      originalStart: start,
      originalEnd: end
    });
  };

  // Ref for event handlers to access current state without triggering re-effects
  const dragStateRef = useRef(dragState);
  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

  const scheduleRef = useRef(schedule);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);

  const rulesRef = useRef(rules);
  useEffect(() => { rulesRef.current = rules; }, [rules]);

  const viewRangeRef = useRef(viewRange);
  useEffect(() => { viewRangeRef.current = viewRange; }, [viewRange]);

  const isDragging = !!dragState;

  useEffect(() => {
    const handleMouseMove = (e) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;

      setDragState(prev => ({ ...prev, currentX: e.clientX }));

      // Boundaries
      const startHourVal = viewRangeRef.current.start;
      const endHourVal = viewRangeRef.current.end;

      const minDate = setHours(setMinutes(startOfDay(new Date()), 0), startHourVal);
      const maxDate = setHours(setMinutes(startOfDay(new Date()), 0), endHourVal);

      if (currentDrag.type === 'CREATE_SHIFT') {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / minWidth;
        const rawEnd = addMinutes(currentDrag.startTime, diffMins);
        let newEnd = roundToNearest15(rawEnd);
        if (newEnd > maxDate) newEnd = maxDate;
        if (differenceInMinutes(newEnd, currentDrag.startTime) < 15) {
          newEnd = addMinutes(currentDrag.startTime, 15);
          if (newEnd > maxDate) newEnd = maxDate;
        }
        setDragState(prev => ({ ...prev, tempEndTime: newEnd }));
      }
    };

    const handleMouseUp = (e) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;
      const fmt = (d) => format(d, 'HH:mm');

      // Boundaries
      const startHourVal = viewRangeRef.current.start;
      const endHourVal = viewRangeRef.current.end;
      const minDate = setHours(setMinutes(startOfDay(new Date()), 0), startHourVal);
      const maxDate = setHours(setMinutes(startOfDay(new Date()), 0), endHourVal);

      if (currentDrag.type === 'CREATE_SHIFT') {
        const { startTime, tempEndTime, empId } = currentDrag;
        // Double check bounds
        if (tempEndTime > startTime && tempEndTime <= maxDate) {
          const breaks = calculateBreaks(fmt(startTime), fmt(tempEndTime), rulesRef.current);
          updateEmployee(empId, { startTime: fmt(startTime), endTime: fmt(tempEndTime) });
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          else newSched.push({ employeeId: empId, breaks });
          updateSchedule(newSched, 'Created Shift');
        }
      }
      else if (currentDrag.type === 'MOVE_SHIFT') {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / minWidth;

        // Absolute Snap Strategy:
        // Calculate raw target start, then snap it.
        const rawStart = addMinutes(currentDrag.originalStart, diffMins);
        let newStart = roundToNearest15(rawStart);

        const duration = differenceInMinutes(currentDrag.originalEnd, currentDrag.originalStart);
        let newEnd = addMinutes(newStart, duration);

        // Clamp
        if (newStart < minDate) {
          newStart = minDate;
          newEnd = addMinutes(newStart, duration);
        }
        if (newEnd > maxDate) {
          newEnd = maxDate;
          newStart = addMinutes(newEnd, -duration);
        }

        // Only update if valid and changed
        if (newStart >= minDate && newEnd <= maxDate && newStart.getTime() !== currentDrag.originalStart.getTime()) {
          const breaks = calculateBreaks(fmt(newStart), fmt(newEnd), rulesRef.current);
          updateEmployee(currentDrag.empId, { startTime: fmt(newStart), endTime: fmt(newEnd) });
          // Move Schedule
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === currentDrag.empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          updateSchedule(newSched, 'Moved Shift');
        }
      }
      else if (currentDrag.type === 'RESIZE_START') {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / minWidth;

        const rawStart = addMinutes(currentDrag.originalStart, diffMins);
        let newStart = roundToNearest15(rawStart);

        // Clamp
        if (newStart < minDate) newStart = minDate;

        if (newStart < currentDrag.originalEnd && newStart.getTime() !== currentDrag.originalStart.getTime()) {
          const breaks = calculateBreaks(fmt(newStart), fmt(currentDrag.originalEnd), rulesRef.current);
          updateEmployee(currentDrag.empId, { startTime: fmt(newStart), endTime: fmt(currentDrag.originalEnd) });
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === currentDrag.empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          updateSchedule(newSched, 'Resized Shift Start');
        }
      }
      else if (currentDrag.type === 'RESIZE_END') {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / minWidth;

        const rawEnd = addMinutes(currentDrag.originalEnd, diffMins);
        let newEnd = roundToNearest15(rawEnd);

        // Clamp
        if (newEnd > maxDate) newEnd = maxDate;

        if (newEnd > currentDrag.originalStart && newEnd.getTime() !== currentDrag.originalEnd.getTime()) {
          const breaks = calculateBreaks(fmt(currentDrag.originalStart), fmt(newEnd), rulesRef.current);
          updateEmployee(currentDrag.empId, { startTime: fmt(currentDrag.originalStart), endTime: fmt(newEnd) });
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === currentDrag.empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          updateSchedule(newSched, 'Resized Shift End');
        }
      }
      else if (currentDrag.type === 'MOVE_BREAK') {
        // ... (Breaks constrained to shift, not timeline directly, though implicitly yes)
        const dX = e.clientX - currentDrag.initialX;
        const diffMins = dX / minWidth;

        const rawStart = addMinutes(currentDrag.originalStartTime, diffMins);
        const newStartTime = roundToNearest15(rawStart);

        if (newStartTime.getTime() !== currentDrag.originalStartTime.getTime()) {
          const currentSchedule = scheduleRef.current;
          const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === currentDrag.empId);
          if (empScheduleIndex !== -1) {
            const newSchedule = [...currentSchedule];
            const empBreaks = [...newSchedule[empScheduleIndex].breaks];

            const bIdx = empBreaks.findIndex(b => b.id === currentDrag.breakId);
            if (bIdx !== -1) {
              const draggedBreak = empBreaks[bIdx];
              const newEndTime = addMinutes(newStartTime, currentDrag.duration);

              // 1. MERGE DETECTION
              const newStartStr = format(newStartTime, 'HH:mm');
              const newEndStr = format(newEndTime, 'HH:mm');
              const getVal = (v) => (v instanceof Date ? format(v, 'HH:mm') : v);

              const mergeTarget = empBreaks.find(b => {
                if (b.id === currentDrag.breakId) return false;

                const tEndStr = getVal(b.endTime);
                const tStartStr = getVal(b.startTime);

                // Strict Adjacency Check (Strings)
                return tEndStr === newStartStr || tStartStr === newEndStr;
              });

              if (mergeTarget) {
                // Trigger Merge UI
                const durationTotal = draggedBreak.duration + mergeTarget.duration;
                setMergeCandidate({
                  empId: currentDrag.empId,
                  draggedBreak,
                  targetBreak: mergeTarget,
                  totalDuration: durationTotal,
                  proposedNewStart: newStartTime // Store where we dropped it for context if we need it
                });
                setDragState(null);
                return;
              }

              // 2. SWAP DETECTION (Existing Logic)
              const targetBreakIndex = empBreaks.findIndex(b =>
                b.id !== currentDrag.breakId &&
                Math.abs(differenceInMinutes(b.startTime, newStartTime)) < 15
              );

              if (targetBreakIndex !== -1) {
                // Perform Swap
                const targetBreak = empBreaks[targetBreakIndex];
                const originalStart = currentDrag.originalStartTime;

                // Move Dragged Break to Target's Position
                empBreaks[bIdx] = {
                  ...empBreaks[bIdx],
                  startTime: targetBreak.startTime,
                  endTime: addMinutes(targetBreak.startTime, empBreaks[bIdx].duration)
                };

                // Move Target Break to Dragged Break's Original Position
                empBreaks[targetBreakIndex] = {
                  ...empBreaks[targetBreakIndex],
                  startTime: originalStart,
                  endTime: addMinutes(originalStart, targetBreak.duration)
                };
              } else {
                // Standard Move
                empBreaks[bIdx] = {
                  ...empBreaks[bIdx],
                  startTime: newStartTime,
                  endTime: addMinutes(newStartTime, currentDrag.duration)
                };
              }

              empBreaks.sort((a, b) => a.startTime - b.startTime);
              newSchedule[empScheduleIndex].breaks = empBreaks;
              updateSchedule(newSchedule, targetBreakIndex !== -1 ? 'Swapped Breaks' : 'Moved Break');
            }
          }
        }
      }

      setDragState(null);
    };

    // Only attach listeners if a drag is active
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minWidth, updateEmployee, updateSchedule]);

  // --- Render Helpers ---
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  // Smart Input Component
  const TimeInput = ({ value, onChange, minVal }) => {
    const [text, setText] = useState('');

    // Sync text with external value prop on mount/update
    useEffect(() => {
      let h = value;
      const isNextDay = h >= 24;
      if (h >= 24) h -= 24;

      const d = setHours(startOfDay(new Date()), h);
      let str = format(d, 'h:mm a');
      if (isNextDay) str += ' (+1)';
      setText(str);
    }, [value]);

    const handleBlur = () => {
      // Parse logic
      const clean = text.toLowerCase().trim().replace(' (+1)', '');
      // Regex for: 1, 1:00, 1am, 1:00pm
      const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm)?$/);

      if (match) {
        let h = parseInt(match[1]);
        const m = match[2] ? parseInt(match[2]) : 0;
        const period = match[3]; // a, p, am, pm

        if (period && (period.startsWith('p'))) {
          if (h < 12) h += 12;
        } else if (period && (period.startsWith('a'))) {
          if (h === 12) h = 0;
        }

        // Adjust decimals? Timeline currently only supports integer hours for range logic
        // The viewRange.start is integer in effect logic.
        // Let's stick to integers for now, or round?
        // Existing logic uses integers.

        // Handle "Next Day" heuristic if minVal is present (for End Time)
        if (minVal !== undefined) {
          // If parsed hour is less than minVal, assume it's next day
          // e.g. minVal=8 (Start). User types "2". 2 < 8 => 26.
          // User types "11". 11 > 8 => 11.
          if (h < minVal) {
            h += 24;
          }
          // Special case: if user typed "1am" explicitly and minVal is 2am?
          // Heuristic: if h < minVal, add 24.
          // What if minVal is 23 (11pm) and user types 1 (1am)? 25. Correct.
          // What if minVal is 8 (8am) and user types 9 (9am)? 9. Correct.
        }

        onChange(h);
      } else {
        // Invalid input, revert
        let h = value;
        const isNextDay = h >= 24;
        if (h >= 24) h -= 24;
        const d = setHours(startOfDay(new Date()), h);
        let str = format(d, 'h:mm a');
        if (isNextDay) str += ' (+1)';
        setText(str);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      }
    };

    return (
      <Input
        type="text"
        className="w-24 h-8 text-center bg-white text-xs font-medium"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  };

  return (
    <div className="space-y-6 select-none" ref={containerRef}>
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          {showSuccess && <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm"><CheckCircle className="w-4 h-4" /> Success</div>}
          {validationErrors.length > 0 && <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-sm"><AlertTriangle className="w-4 h-4" /> {validationErrors.length} Issues</div>}
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-2 mr-4 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-semibold text-slate-500 uppercase">Start</span>
              <TimeInput
                value={viewRange.start}
                onChange={(v) => updateViewRange({ ...viewRange, start: v })}
              />
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-semibold text-slate-500 uppercase">End</span>
              <TimeInput
                value={viewRange.end}
                minVal={viewRange.start}
                onChange={(v) => updateViewRange({ ...viewRange, end: v })}
              />         </div>
          </div>
          <Button onClick={() => updateSchedule([], 'Cleared')} variant="outline" className="text-red-700">Clear</Button>
          <Button onClick={generateSchedule} className="bg-indigo-600 text-white flex items-center gap-2"><Play className="w-4 h-4 fill-current" /> Generate</Button>
          <Button onClick={handleValidate} variant="secondary">Validate</Button>
        </div>
      </div>

      {/* Main Schedule Area */}
      <div
        className="bg-white rounded-xl shadow-sm border border-slate-200 relative"
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={handleContainerMouseLeave}
      >
        {/* Crosshair Guide */}
        {crosshairX !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-900 opacity-20 z-0 pointer-events-none"
            style={{ left: crosshairX }}
          />
        )}

        {/* Current Time Indicator */}
        {(() => {
          const h = currentTime.getHours() + currentTime.getMinutes() / 60;
          // Handle overnight wrap if needed, or simplistically
          // If view is 8-20, and time is 21, don't show.
          // If view is 8-20, and time is 9, show.

          // Using getLeftPos:
          const leftPos = getLeftPos(currentTime) + 192; // SIDEBAR_WIDTH hardcoded as 192 here based on context var being inside render scope? 
          // Wait, SIDEBAR_WIDTH is defined in scope? Yes, line 37.

          if (leftPos > 192 && leftPos < (containerWidth)) {
            return (
              <div
                className="absolute top-0 bottom-0 w-px border-l-2 border-red-400 border-dashed z-40 pointer-events-none opacity-60"
                style={{ left: leftPos }}
              >
              </div>
            );
          }
          return null;
        })()}

        {/* Global Break Guide Line */}
        {dragState?.type === 'MOVE_BREAK' && (() => {
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
        })()}

        {/* Timeline Header */}
        <div className="h-10 border-b border-slate-100 flex sticky left-0 w-full bg-slate-50/50">
          <div className="w-48 shrink-0 sticky left-0 bg-white z-10 border-r border-slate-100 flex items-center justify-between px-4 font-semibold text-slate-500 text-sm">
            <span>Team Member</span>
            <button
              onClick={() => setSortByTime(!sortByTime)}
              className={`p-1 rounded hover:bg-slate-100 transition-colors ${sortByTime ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
              title="Sort by Start Time"
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex-1 h-full">
            {hours.map(h => (
              <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100 text-xs text-slate-400 pl-1 pt-2 font-medium" style={{ left: (h - startHour) * hourWidth }}>
                {h % 24}:00
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="w-full">
          {employees.length === 0 && <div className="p-12 text-center text-slate-400">No employees.</div>}

          {sortedEmployees.map(emp => {
            const empSchedule = schedule.find(s => s.employeeId === emp.id);
            const hasShift = empSchedule && emp.startTime && emp.endTime;

            let shiftStart = emp.startTime ? parse(emp.startTime, 'HH:mm', new Date()) : null;
            let shiftEnd = emp.endTime ? parse(emp.endTime, 'HH:mm', new Date()) : null;

            if (shiftStart && shiftEnd && shiftEnd < shiftStart) {
              shiftEnd = addMinutes(shiftEnd, 24 * 60);
            }

            // Calculate position stats
            let visualStart = shiftStart, visualEnd = shiftEnd;
            let isDraggingShift = false;

            if (dragState && dragState.empId === emp.id) {
              if (dragState.type === 'MOVE_SHIFT') {
                isDraggingShift = true;
                const diffPx = dragState.currentX - dragState.startX;
                const diffMins = Math.round((diffPx / minWidth) / 15) * 15;
                visualStart = addMinutes(dragState.originalStart, diffMins);
                visualEnd = addMinutes(dragState.originalEnd, diffMins);
              } else if (dragState.type === 'RESIZE_START') {
                isDraggingShift = true;
                const diffPx = dragState.currentX - dragState.startX;
                const diffMins = Math.round((diffPx / minWidth) / 15) * 15;
                visualStart = addMinutes(dragState.originalStart, diffMins);
              } else if (dragState.type === 'RESIZE_END') {
                isDraggingShift = true;
                const diffPx = dragState.currentX - dragState.startX;
                const diffMins = Math.round((diffPx / minWidth) / 15) * 15;
                visualEnd = addMinutes(dragState.originalEnd, diffMins);
              }
            }

            // Render Props
            const startLeft = visualStart ? getLeftPos(visualStart) : 0;
            const durationMins = (visualStart && visualEnd) ? differenceInMinutes(visualEnd, visualStart) : 0;
            const width = (durationMins / 60) * hourWidth;
            const durationHrs = Math.round((durationMins / 60) * 100) / 100;
            const roleColor = roleColors?.[emp.roles[0]] || '#f1f5f9';

            return (
              <div key={emp.id} className="flex h-16 border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative hover:z-30">
                {/* Sidebar */}
                <div className="w-48 shrink-0 sticky left-0 bg-white z-10 border-r border-slate-100 p-3 flex flex-col justify-center shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] group/idx">
                  <div className="flex justify-between items-start">
                    <div
                      className="relative overflow-visible"
                      onMouseEnter={() => {
                        if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
                      }}
                      onMouseLeave={() => {
                        swapTimeoutRef.current = setTimeout(() => {
                          setSwapCandidate(null);
                        }, 300);
                      }}
                    >
                      <div
                        className="font-medium text-slate-800 text-sm truncate cursor-pointer hover:text-indigo-600 flex items-center gap-1 group/name"
                        onClick={(e) => { e.stopPropagation(); setSwapCandidate(swapCandidate === emp.id ? null : emp.id); }}
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
                        <div
                          className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-[100] overflow-hidden animate-in fade-in zoom-in-95"
                          onMouseEnter={() => {
                            if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
                          }}
                        >
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
                                  onClick={(e) => { e.stopPropagation(); handleSwapEmployee(r.id); }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between"
                                >
                                  {r.name}
                                  <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-1 rounded">{r.defaultRole}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}

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
                        {hasShift && <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-1">{durationHrs}h</span>}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeEmployee(emp.id); }} className="opacity-0 group-hover/idx:opacity-100 text-slate-300 hover:text-red-500 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Interactive Area */}
                <div
                  className="relative flex-1 h-full cursor-crosshair"
                  onMouseDown={(e) => handleCreateMouseDown(e, emp.id, empSchedule)}
                >
                  {/* Grid Lines */}
                  {hours.map(h => (
                    <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100 pointer-events-none" style={{ left: (h - startHour) * hourWidth }}></div>
                  ))}

                  {/* Ghost (Creation) */}
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

                  {/* Actual Shift Block */}
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
                      onMouseDown={(e) => handleShiftMoveStart(e, emp.id, shiftStart, shiftEnd)}
                    >
                      {/* Resize Handles */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-20 hover:bg-black/10 transition-colors rounded-l-lg"
                        onMouseDown={(e) => handleShiftResizeStart(e, emp.id, 'START', shiftStart, shiftEnd)}
                      ></div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-20 hover:bg-black/10 transition-colors rounded-r-lg"
                        onMouseDown={(e) => handleShiftResizeStart(e, emp.id, 'END', shiftStart, shiftEnd)}
                      ></div>
                      {/* Shift Details Tooltip */}
                      <div className="hidden group-hover/shift:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg z-50 w-max pointer-events-none">
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
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800"></div>
                      </div>

                      {/* Breaks */}
                      {empSchedule?.breaks.map(brk => {
                        const isDragging = dragState?.type === 'MOVE_BREAK' && dragState.breakId === brk.id;
                        const isHovering = hoveredBreakId === brk.id;
                        let visualLeft;
                        let displayTime = '';
                        let activeTimeStr = '';

                        if (isDragging) {
                          const dX = dragState.currentX - dragState.initialX;

                          // Calculate raw time based on drag
                          const rawTime = addMinutes(dragState.originalStartTime, dX / minWidth);

                          // Snap to 15m grid
                          const snappedTime = roundToNearest15(rawTime);

                          // Calculate visual position from snapped time
                          visualLeft = differenceInMinutes(snappedTime, shiftStart) * minWidth;

                          activeTimeStr = format(snappedTime, 'HH:mm');
                          displayTime = activeTimeStr;
                        } else {
                          visualLeft = (differenceInMinutes(brk.startTime, shiftStart) * minWidth);
                          displayTime = format(brk.startTime, 'HH:mm');
                        }
                        const width = brk.duration * minWidth;

                        return (
                          <div
                            key={brk.id}
                            onMouseEnter={() => setHoveredBreakId(brk.id)}
                            onMouseLeave={() => setHoveredBreakId(null)}
                            onMouseDown={(e) => handleBreakMouseDown(e, brk, emp.id)}
                            className={`absolute top-1 bottom-1 rounded-md shadow-sm border flex items-center justify-center text-[10px] font-bold cursor-grab active:cursor-grabbing
                                        ${brk.type === 'merged' ? 'bg-indigo-50 border-2 border-dashed border-indigo-400 text-indigo-700 z-20' :
                                brk.type === 'paid' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-orange-100 border-orange-200 text-orange-700'}
                                    `}
                            style={{
                              left: visualLeft,
                              width: width,
                              transition: isDragging ? 'none' : 'all 0.2s ease',
                              zIndex: (isDragging || isHovering) ? 50 : 10
                            }}
                            title={`${brk.type} break`}
                          >
                            {isHovering && !isDragging && brk.type === 'merged' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); unlinkBreak(emp.id, brk.id); }}
                                className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-slate-200 z-[60] flex items-center justify-center w-5 h-5"
                                title="Unlink Breaks"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {brk.duration}
                            {isHovering && !isDragging && (
                              <div className="absolute bottom-full left-0 flex flex-col items-center pb-1 -translate-x-1/2 pointer-events-none">
                                <div className="bg-white text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-indigo-100 mb-0.5 whitespace-nowrap">
                                  {displayTime}
                                </div>
                                <div className="w-px h-8 bg-indigo-500"></div>
                              </div>
                            )}

                            {/* Left/Right Gap Measurements - ONLY WHEN DRAGGING */}
                            {isDragging && (() => {
                              // Recalculate context for gaps
                              const dX = dragState.currentX - dragState.initialX;
                              const snappedDeltaPx = Math.round(dX / (15 * minWidth)) * (15 * minWidth);
                              const deltaMins = snappedDeltaPx / minWidth;

                              const sTime = addMinutes(dragState.originalStartTime, deltaMins);
                              const sEnd = addMinutes(sTime, brk.duration);

                              // Neighbors from original data
                              // Safe sort helper
                              const getT = (d) => (d instanceof Date ? d.getTime() : typeof d === 'string' ? parse(d, 'HH:mm', new Date()).getTime() : 0);

                              const sortedOthers = [...empSchedule.breaks].filter(b => b.id !== brk.id).sort((a, b) => getT(a.startTime) - getT(b.startTime));

                              let pEnd = shiftStart;
                              let nStart = shiftEnd;

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
                                }
                              }

                              const lGap = differenceInMinutes(sTime, pEnd);
                              const rGap = differenceInMinutes(nStart, sEnd);

                              const fmtD = (m) => {
                                if (m <= 0) return null;
                                const h = Math.floor(m / 60);
                                const r = m % 60;
                                let parts = [];
                                if (h > 0) parts.push(`${h}h`);
                                if (r > 0) parts.push(`${r}m`);
                                return parts.join(' ');
                              };
                              const lgTx = fmtD(lGap);
                              const rgTx = fmtD(rGap);

                              // Look ahead for potential merge partner
                              let linkButton = null;
                              if (idx < sortedOthers.length - 1) {
                                const nextBreak = sortedOthers[idx + 1];
                                const rbTime = nextBreak.startTime instanceof Date ? nextBreak.startTime : parse(nextBreak.startTime, 'HH:mm', new Date());
                                const lbEnd = bEnd;

                                const gapMins = differenceInMinutes(rbTime, lbEnd);

                                if (gapMins <= 30 && gapMins >= -5) { // Allow slight overlap or tight gap
                                  const gapCenter = getLeftPos(lbEnd) + (gapMins * minWidth) / 2;

                                  linkButton = (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMergeBreaks(emp.id, brk, nextBreak);
                                      }}
                                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 bg-white border border-indigo-200 rounded-full p-1 shadow-sm hover:scale-110 hover:border-indigo-500 transition-all group/link"
                                      style={{ left: gapCenter }}
                                      title="Merge with next break"
                                    >
                                      <Link className="w-3 h-3 text-indigo-400 group-hover/link:text-indigo-600" />
                                    </button>
                                  );
                                }
                              }

                              return (
                                <>
                                  {/* --- Merged Type Indicator / Unlink Option --- */}
                                  {brk.type === 'merged' && (
                                    <div className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          unlinkBreak(emp.id, brk.id);
                                        }}
                                        className="bg-white/90 p-1 rounded-full text-slate-500 hover:text-red-500 hover:bg-white shadow-sm"
                                        title="Unlink merged breaks"
                                      >
                                        <Unlink2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  {lgTx && (
                                    <div className="absolute right-full top-0 bottom-0 flex items-center justify-center pointer-events-none" style={{ width: lGap * minWidth }}>
                                      <div className="w-full h-px bg-indigo-300 absolute top-1/2"></div>
                                      <span className="bg-white px-1 text-[10px] font-medium text-indigo-500 relative z-10">{lgTx}</span>
                                    </div>
                                  )}
                                  {rgTx && (
                                    <div className="absolute left-full top-0 bottom-0 flex items-center justify-center pointer-events-none" style={{ width: rGap * minWidth }}>
                                      <div className="w-full h-px bg-indigo-300 absolute top-1/2"></div>
                                      <span className="bg-white px-1 text-[10px] font-medium text-indigo-500 relative z-10">{rgTx}</span>
                                    </div>
                                  )}
                                  {linkButton}
                                </>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Row Section */}
        <div className="relative border-t border-slate-100 p-2 bg-slate-50/50" ref={addMenuRef}>
          <div onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className="w-full flex items-center p-2 rounded-md hover:bg-slate-100 cursor-pointer group">
            <div className="w-48 shrink-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-indigo-600 font-medium text-sm group-hover:text-indigo-700">
                <Plus className="w-4 h-4" /> Add Row
              </div>
            </div>
            <div className="text-xs text-slate-400 italic pl-4 group-hover:text-slate-500">
              Select from Master Roster
            </div>
          </div>

          {isAddMenuOpen && (
            <div className="absolute left-2 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-96">

              <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-500 bg-slate-50">
                Select Employee
              </div>
              <div className="overflow-y-auto">
                {availableEmployees.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm italic">
                    All employees added.
                  </div>
                ) : (
                  availableEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        addEmployee({
                          name: emp.name,
                          default_role: emp.defaultRole,
                          avatarColor: emp.avatarColor,
                          // Don't pass 'roles' array here to avoid stale data
                          startTime: '09:00',
                          endTime: '17:00'
                        });
                        setIsAddMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex flex-col border-b border-slate-50 last:border-0"
                    >
                      <span className="font-medium text-slate-800 text-sm">{emp.name}</span>
                      <span className="text-xs text-slate-500">{emp.defaultRole}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-slate-100 bg-slate-50">
                <Button
                  onClick={() => window.location.hash = '#employees'}
                  variant="ghost"
                  className="w-full text-xs justify-center h-8 text-indigo-600"
                >
                  Manage Roster
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Labor Chart Section */}
        {schedule.length > 0 && (
          <div className="border-t border-slate-100 flex flex-col">
            <div className="p-3 border-b border-slate-100 font-semibold text-slate-700 text-sm bg-slate-50/50">
              Labor Coverage
            </div>
            <div className="w-full">
              <div className="flex">
                <div className="w-48 shrink-0 bg-white border-r border-slate-100"></div>
                <div className="flex-1">
                  <LaborChart
                    employees={employees}
                    schedule={schedule}
                    startHour={startHour}
                    endHour={endHour}
                    rules={coverageRules}
                    roleColors={roleColors}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    </div >
  );
};
