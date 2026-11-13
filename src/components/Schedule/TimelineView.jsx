import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { parse, format, addMinutes, differenceInMinutes, setHours, setMinutes, startOfDay, roundToNearestMinutes } from 'date-fns';
import { Play, AlertTriangle, CheckCircle, Plus, RefreshCw, CalendarDays } from 'lucide-react';

import { calculateBreaks } from '../../utils/scheduler';
import { usePlanner } from '../../context/PlannerContext';
import { Button } from '../ui/Button';
import { LaborChart } from './LaborChart';
import { SIDEBAR_WIDTH, DRAG_TYPES } from '../../utils/constants';
import {
  Crosshair,
  CurrentTimeIndicator,
  BreakGuideLine,
  TimelineHeader,
  TimelineRow,
  ValidationOverlay
} from './components';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const roundToNearest15 = (date) => roundToNearestMinutes(date, { nearestTo: 15, roundingMethod: 'round' });

const getTime = (d) => (d instanceof Date ? d : parse(d, 'HH:mm', new Date())).getTime();

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TimelineView = () => {
  // ==========================================================================
  // CONTEXT
  // ==========================================================================
  const {
    employees,
    schedule,
    generateSchedule,
    updateSchedule,
    validationErrors,
    roleColors,
    activityLog,
    validateNow,
    removeEmployee,
    addEmployee,
    roster,
    updateEmployee,
    rules,
    coverageRules,
    viewRange,
    syncFromWhenIWork,
    planDate,
    setPlanDate
  } = usePlanner();

  // ==========================================================================
  // REFS (for event handlers to access current state without re-effects)
  // ==========================================================================
  const containerRef = useRef(null);
  const crosshairRef = useRef(null);
  const addMenuRef = useRef(null);
  const dragStateRef = useRef(null);
  const scheduleRef = useRef(schedule);
  const rulesRef = useRef(rules);
  const viewRangeRef = useRef(viewRange);

  // Keep refs in sync with state
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { rulesRef.current = rules; }, [rules]);
  useEffect(() => { viewRangeRef.current = viewRange; }, [viewRange]);

  // ==========================================================================
  // LOCAL UI STATE
  // ==========================================================================
  const [dragState, setDragState] = useState(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [hoveredBreakId, setHoveredBreakId] = useState(null);
  const [sortByTime, setSortByTime] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [swapCandidate, setSwapCandidate] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1000);
  const [selectedBreak, setSelectedBreak] = useState(null); // { empId, breakId }

  // When I Work sync state (the date itself is the shared planDate in context —
  // it's also the date the schedule is saved under and restored with)
  const syncDate = planDate;
  const setSyncDate = setPlanDate;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { type, message }

  // Dismissed warnings, keyed by time|message. Validation is derived, so if a
  // problem changes (different count/time) it reappears as a new key; a
  // dismissed problem that's later FIXED simply disappears.
  const [dismissedWarnings, setDismissedWarnings] = useState(() => new Set());
  const warningKey = (w) => `${w.time}|${w.message}`;
  const visibleErrors = useMemo(
    () => validationErrors.filter(w => !dismissedWarnings.has(`${w.time}|${w.message}`)),
    [validationErrors, dismissedWarnings]
  );
  const dismissedCount = validationErrors.length - visibleErrors.length;
  const breakConflictCount = visibleErrors.filter(w => w.kind === 'break').length;
  const staffingGapCount = visibleErrors.length - breakConflictCount;
  const dismissWarning = (w) => setDismissedWarnings(prev => new Set(prev).add(warningKey(w)));
  const dismissAllWarnings = () => setDismissedWarnings(new Set(validationErrors.map(warningKey)));
  const restoreWarnings = () => setDismissedWarnings(new Set());

  // Keep dragStateRef in sync
  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

  // ==========================================================================
  // DERIVED VALUES (memoized for performance)
  // ==========================================================================
  const startHour = viewRange.start;
  const endHour = viewRange.end;
  const totalHours = Math.max(1, endHour - startHour);
  const timelineWidth = Math.max(100, containerWidth - SIDEBAR_WIDTH);
  const hourWidth = timelineWidth / totalHours;
  const minWidth = hourWidth / 60; // px per minute

  // Hour labels array - memoized to prevent recreation on every render
  const hours = useMemo(
    () => Array.from({ length: totalHours + 1 }, (_, i) => startHour + i),
    [totalHours, startHour]
  );

  // Sorted employees list
  const displayedEmployees = useMemo(() => {
    if (!sortByTime) return employees;
    return [...employees].sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      const tA = parse(a.startTime, 'HH:mm', new Date());
      const tB = parse(b.startTime, 'HH:mm', new Date());
      const vA = isNaN(tA.getTime()) ? Infinity : tA.getTime();
      const vB = isNaN(tB.getTime()) ? Infinity : tB.getTime();
      return vA - vB;
    });
  }, [employees, sortByTime]);

  // Available employees for adding/swapping
  const availableEmployees = useMemo(
    () => roster.filter(r => !employees.some(e => e.name === r.name)),
    [roster, employees]
  );

  // ==========================================================================
  // POSITION CALCULATION
  // ==========================================================================
  const getLeftPos = useCallback((timeStr) => {
    let date = typeof timeStr === 'string' ? parse(timeStr, 'HH:mm', new Date()) : timeStr;
    const hours = date.getHours() + date.getMinutes() / 60;
    let h = hours;
    if (h < startHour) h += 24;
    return (h - startHour) * hourWidth;
  }, [startHour, hourWidth]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Live timer - update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Container resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Close add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for selected break
  useEffect(() => {
    if (!selectedBreak) return;

    const handleKeyDown = (e) => {
      if (!selectedBreak) return;

      const { empId, breakId } = selectedBreak;
      const currentSchedule = scheduleRef.current;
      const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === empId);
      if (empScheduleIndex === -1) return;

      const empBreaks = currentSchedule[empScheduleIndex].breaks;
      const breakIndex = empBreaks.findIndex(b => b.id === breakId);
      if (breakIndex === -1) return;

      const brk = empBreaks[breakIndex];

      // Arrow keys move break by 15 minutes
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -15 : 15;
        const newStartTime = addMinutes(brk.startTime, delta);
        const newEndTime = addMinutes(newStartTime, brk.duration);

        const newSchedule = [...currentSchedule];
        const newEmpBreaks = [...empBreaks];
        newEmpBreaks[breakIndex] = {
          ...brk,
          startTime: newStartTime,
          endTime: newEndTime
        };
        newEmpBreaks.sort((a, b) => getTime(a.startTime) - getTime(b.startTime));
        newSchedule[empScheduleIndex] = {
          ...newSchedule[empScheduleIndex],
          breaks: newEmpBreaks
        };
        updateSchedule(newSchedule, `Moved Break ${e.key === 'ArrowLeft' ? '←' : '→'}`);
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedBreak(null);
      }

      // Tab to select next/previous break
      if (e.key === 'Tab') {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        const newIndex = breakIndex + direction;

        if (newIndex >= 0 && newIndex < empBreaks.length) {
          // Select next break in same employee
          setSelectedBreak({ empId, breakId: empBreaks[newIndex].id });
        } else {
          // Move to next/previous employee
          const empIndex = displayedEmployees.findIndex(emp => emp.id === empId);
          const nextEmpIndex = empIndex + direction;

          if (nextEmpIndex >= 0 && nextEmpIndex < displayedEmployees.length) {
            const nextEmp = displayedEmployees[nextEmpIndex];
            const nextEmpSchedule = currentSchedule.find(s => s.employeeId === nextEmp.id);
            if (nextEmpSchedule && nextEmpSchedule.breaks.length > 0) {
              const targetBreak = direction > 0
                ? nextEmpSchedule.breaks[0]
                : nextEmpSchedule.breaks[nextEmpSchedule.breaks.length - 1];
              setSelectedBreak({ empId: nextEmp.id, breakId: targetBreak.id });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBreak, displayedEmployees, updateSchedule]);

  // ==========================================================================
  // DRAG HANDLERS
  // ==========================================================================

  const handleCreateMouseDown = useCallback((e, empId, existingSchedule) => {
    if (existingSchedule) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const localMinWidth = rect.width / (totalHours * 60);
    const relativeX = e.clientX - rect.left;
    const clickMinutes = (relativeX / localMinWidth);
    const startTime = addMinutes(setHours(setMinutes(new Date(), 0), startHour), clickMinutes);
    let snappedStart = new Date(Math.round(startTime.getTime() / (15 * 60000)) * (15 * 60000));

    const minDate = setHours(setMinutes(startOfDay(new Date()), 0), startHour);
    const maxDate = setHours(setMinutes(startOfDay(new Date()), 0), endHour);

    if (snappedStart < minDate) snappedStart = minDate;
    if (snappedStart >= maxDate) snappedStart = addMinutes(maxDate, -15);

    setDragState({
      type: DRAG_TYPES.CREATE_SHIFT,
      empId,
      startX: e.clientX,
      currentX: e.clientX,
      startTime: snappedStart,
      tempEndTime: addMinutes(snappedStart, 60),
      minWidth: localMinWidth
    });
  }, [totalHours, startHour, endHour]);

  const handleBreakMouseDown = useCallback((e, brk, empId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      type: DRAG_TYPES.MOVE_BREAK,
      breakId: brk.id,
      empId,
      initialX: e.clientX,
      currentX: e.clientX,
      originalStartTime: brk.startTime,
      duration: brk.duration,
      minWidth: minWidth
    });
  }, [minWidth]);

  const handleShiftMoveStart = useCallback((e, empId, start, end) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      type: DRAG_TYPES.MOVE_SHIFT,
      empId,
      startX: e.clientX,
      currentX: e.clientX,
      originalStart: start,
      originalEnd: end,
      minWidth: minWidth
    });
  }, [minWidth]);

  const handleShiftResizeStart = useCallback((e, empId, edge, start, end) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      type: edge === 'START' ? DRAG_TYPES.RESIZE_START : DRAG_TYPES.RESIZE_END,
      empId,
      startX: e.clientX,
      currentX: e.clientX,
      originalStart: start,
      originalEnd: end,
      minWidth: minWidth
    });
  }, [minWidth]);

  // Global mouse move/up handlers for drag operations
  useEffect(() => {
    const isDragging = !!dragState;
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;

      setDragState(prev => ({ ...prev, currentX: e.clientX }));

      const startHourVal = viewRangeRef.current.start;
      const endHourVal = viewRangeRef.current.end;
      const maxDate = setHours(setMinutes(startOfDay(new Date()), 0), endHourVal);
      const dragMinWidth = currentDrag.minWidth || minWidth;

      if (currentDrag.type === DRAG_TYPES.CREATE_SHIFT) {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / dragMinWidth;
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

      const startHourVal = viewRangeRef.current.start;
      const endHourVal = viewRangeRef.current.end;
      const minDate = setHours(setMinutes(startOfDay(new Date()), 0), startHourVal);
      const maxDate = setHours(setMinutes(startOfDay(new Date()), 0), endHourVal);
      const dragMinWidth = currentDrag.minWidth || minWidth;

      if (currentDrag.type === DRAG_TYPES.CREATE_SHIFT) {
        const { startTime, tempEndTime, empId } = currentDrag;

        if (isNaN(startTime.getTime()) || isNaN(tempEndTime.getTime())) {
          setDragState(null);
          return;
        }

        if (tempEndTime > startTime && tempEndTime <= maxDate) {
          try {
            const breaks = calculateBreaks(fmt(startTime), fmt(tempEndTime), rulesRef.current);
            updateEmployee(empId, { startTime: fmt(startTime), endTime: fmt(tempEndTime) });
            const newSched = [...scheduleRef.current];
            const idx = newSched.findIndex(s => s.employeeId === empId);
            if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
            else newSched.push({ employeeId: empId, breaks });
            updateSchedule(newSched, 'Created Shift');
          } catch (err) {
            console.error('Error creating shift:', err);
            updateEmployee(empId, { startTime: fmt(startTime), endTime: fmt(tempEndTime) });
            const newSched = [...scheduleRef.current];
            const idx = newSched.findIndex(s => s.employeeId === empId);
            if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks: [] };
            else newSched.push({ employeeId: empId, breaks: [] });
            updateSchedule(newSched, 'Created Shift (No Breaks)');
          }
        }
      } else if (currentDrag.type === DRAG_TYPES.MOVE_SHIFT) {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / dragMinWidth;
        const rawStart = addMinutes(currentDrag.originalStart, diffMins);
        let newStart = roundToNearest15(rawStart);
        const duration = differenceInMinutes(currentDrag.originalEnd, currentDrag.originalStart);
        let newEnd = addMinutes(newStart, duration);

        if (newStart < minDate) {
          newStart = minDate;
          newEnd = addMinutes(newStart, duration);
        }
        if (newEnd > maxDate) {
          newEnd = maxDate;
          newStart = addMinutes(newEnd, -duration);
        }

        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
          setDragState(null);
          return;
        }

        if (newStart >= minDate && newEnd <= maxDate && newStart.getTime() !== currentDrag.originalStart.getTime()) {
          const breaks = calculateBreaks(fmt(newStart), fmt(newEnd), rulesRef.current);
          updateEmployee(currentDrag.empId, { startTime: fmt(newStart), endTime: fmt(newEnd) });
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === currentDrag.empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          updateSchedule(newSched, 'Moved Shift');
        }
      } else if (currentDrag.type === DRAG_TYPES.RESIZE_START) {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / dragMinWidth;
        const rawStart = addMinutes(currentDrag.originalStart, diffMins);
        let newStart = roundToNearest15(rawStart);

        if (newStart < minDate) newStart = minDate;
        if (isNaN(newStart.getTime())) {
          setDragState(null);
          return;
        }

        if (newStart < currentDrag.originalEnd && newStart.getTime() !== currentDrag.originalStart.getTime()) {
          const breaks = calculateBreaks(fmt(newStart), fmt(currentDrag.originalEnd), rulesRef.current);
          updateEmployee(currentDrag.empId, { startTime: fmt(newStart), endTime: fmt(currentDrag.originalEnd) });
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === currentDrag.empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          updateSchedule(newSched, 'Resized Shift Start');
        }
      } else if (currentDrag.type === DRAG_TYPES.RESIZE_END) {
        const diffPx = e.clientX - currentDrag.startX;
        const diffMins = diffPx / dragMinWidth;
        const rawEnd = addMinutes(currentDrag.originalEnd, diffMins);
        let newEnd = roundToNearest15(rawEnd);

        if (newEnd > maxDate) newEnd = maxDate;
        if (isNaN(newEnd.getTime())) {
          setDragState(null);
          return;
        }

        if (newEnd > currentDrag.originalStart && newEnd.getTime() !== currentDrag.originalEnd.getTime()) {
          const breaks = calculateBreaks(fmt(currentDrag.originalStart), fmt(newEnd), rulesRef.current);
          updateEmployee(currentDrag.empId, { startTime: fmt(currentDrag.originalStart), endTime: fmt(newEnd) });
          const newSched = [...scheduleRef.current];
          const idx = newSched.findIndex(s => s.employeeId === currentDrag.empId);
          if (idx >= 0) newSched[idx] = { ...newSched[idx], breaks };
          updateSchedule(newSched, 'Resized Shift End');
        }
      } else if (currentDrag.type === DRAG_TYPES.MOVE_BREAK) {
        const dX = e.clientX - currentDrag.initialX;
        const diffMins = dX / dragMinWidth;
        const rawStart = addMinutes(currentDrag.originalStartTime, diffMins);
        const newStartTime = roundToNearest15(rawStart);

        if (isNaN(newStartTime.getTime())) {
          setDragState(null);
          return;
        }

        if (newStartTime.getTime() !== currentDrag.originalStartTime.getTime()) {
          const currentSchedule = scheduleRef.current;
          const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === currentDrag.empId);
          if (empScheduleIndex !== -1) {
            const newSchedule = [...currentSchedule];
            const empBreaks = [...newSchedule[empScheduleIndex].breaks];
            const bIdx = empBreaks.findIndex(b => b.id === currentDrag.breakId);

            if (bIdx !== -1) {
              const targetBreakIndex = empBreaks.findIndex(b =>
                b.id !== currentDrag.breakId &&
                Math.abs(differenceInMinutes(b.startTime, newStartTime)) < 15
              );

              if (targetBreakIndex !== -1) {
                const targetBreak = empBreaks[targetBreakIndex];
                const originalStart = currentDrag.originalStartTime;

                empBreaks[bIdx] = {
                  ...empBreaks[bIdx],
                  startTime: targetBreak.startTime,
                  endTime: addMinutes(targetBreak.startTime, empBreaks[bIdx].duration)
                };

                empBreaks[targetBreakIndex] = {
                  ...empBreaks[targetBreakIndex],
                  startTime: originalStart,
                  endTime: addMinutes(originalStart, targetBreak.duration)
                };
              } else {
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

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, minWidth, updateEmployee, updateSchedule]);

  // ==========================================================================
  // BREAK OPERATIONS
  // ==========================================================================

  const handleMergeBreaks = useCallback((empId, break1, break2) => {
    const currentSchedule = scheduleRef.current;
    const empScheduleIndex = currentSchedule.findIndex(s => s.employeeId === empId);
    if (empScheduleIndex === -1) return;

    const newSchedule = [...currentSchedule];
    const empBreaks = [...newSchedule[empScheduleIndex].breaks];

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

    const updatedBreaks = empBreaks.filter(b => b.id !== break1.id && b.id !== break2.id);
    updatedBreaks.push(mergedBreak);
    updatedBreaks.sort((a, b) => getTime(a.startTime) - getTime(b.startTime));

    newSchedule[empScheduleIndex].breaks = updatedBreaks;
    updateSchedule(newSchedule, 'Merged Breaks');
  }, [updateSchedule]);

  const unlinkBreak = useCallback((empId, breakId) => {
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
        empBreaks.sort((a, b) => getTime(a.startTime) - getTime(b.startTime));
        newSchedule[empScheduleIndex].breaks = empBreaks;
        updateSchedule(newSchedule, 'Unlinked Break');
      }
    }
  }, [updateSchedule]);

  // ==========================================================================
  // EMPLOYEE OPERATIONS
  // ==========================================================================

  const handleSwapEmployee = useCallback((newId) => {
    if (!swapCandidate) return;
    const oldId = swapCandidate;
    const newEmp = roster.find(r => r.id === newId);
    if (!newEmp) return;

    const newRole = newEmp.defaultRole || (newEmp.roles && newEmp.roles[0]) || 'Staff';

    updateEmployee(oldId, {
      name: newEmp.name,
      roles: [newRole],
      defaultRole: newRole
    });

    setSwapCandidate(null);
  }, [swapCandidate, roster, updateEmployee]);

  // ==========================================================================
  // UI HANDLERS
  // ==========================================================================

  const handleContainerMouseMove = useCallback((e) => {
    const line = crosshairRef.current;
    if (!containerRef.current || !line) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > SIDEBAR_WIDTH) {
      line.style.left = `${x}px`;
      line.style.display = 'block';
    } else {
      line.style.display = 'none';
    }
  }, []);

  const handleContainerMouseLeave = useCallback(() => {
    if (crosshairRef.current) crosshairRef.current.style.display = 'none';
  }, []);

  const handleValidate = useCallback(() => {
    if (validateNow()) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [validateNow]);

  const handleAddEmployee = useCallback((emp) => {
    addEmployee({
      name: emp.name,
      default_role: emp.defaultRole,
      avatarColor: emp.avatarColor,
      startTime: '09:00',
      endTime: '17:00'
    });
    setIsAddMenuOpen(false);
  }, [addEmployee]);

  const handleSyncWhenIWork = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncFromWhenIWork(syncDate);
      if (res.errors?.length) {
        setSyncStatus({
          type: 'error',
          message: res.errors[0]
        });
      } else {
        const unmatchedNote = res.unmatched > 0 ? `, ${res.unmatched} unmatched (not on roster)` : '';
        setSyncStatus({
          type: 'success',
          message: `Synced: ${res.added} added, ${res.updated} updated, ${res.off} not scheduled${unmatchedNote}`
        });
      }
    } catch (e) {
      setSyncStatus({ type: 'error', message: e.message || 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  }, [syncFromWhenIWork, syncDate]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6 select-none" ref={containerRef}>
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          {showSuccess && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4" /> Success
            </div>
          )}
          {breakConflictCount > 0 && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-sm" title="Breaks take coverage below a rule's minimum — fixable by moving breaks">
              <AlertTriangle className="w-4 h-4" /> {breakConflictCount} break conflict{breakConflictCount === 1 ? '' : 's'}
            </div>
          )}
          {staffingGapCount > 0 && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg text-sm" title="Too few people scheduled for a rule — comes from the shift schedule, not the break plan">
              <AlertTriangle className="w-4 h-4" /> {staffingGapCount} staffing gap{staffingGapCount === 1 ? '' : 's'}
            </div>
          )}
          {syncStatus && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              syncStatus.type === 'error'
                ? 'text-red-600 bg-red-50'
                : 'text-emerald-600 bg-emerald-50'
            }`}>
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>{syncStatus.message}</span>
              <button
                onClick={() => setSyncStatus(null)}
                className="ml-1 text-current opacity-50 hover:opacity-100 text-xs"
                title="Dismiss"
              >✕</button>
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={syncDate}
              onChange={e => setSyncDate(e.target.value)}
              className="bg-transparent text-sm text-slate-700 focus:outline-none"
            />
          </div>
          <Button
            onClick={handleSyncWhenIWork}
            variant="secondary"
            disabled={isSyncing}
            className="flex items-center gap-2"
            title="Pull shifts from When I Work feeds into the daily team"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing…' : 'Sync WIW'}
          </Button>
          <Button onClick={() => updateSchedule([], 'Cleared')} variant="outline" className="text-red-700">
            Clear
          </Button>
          <Button onClick={generateSchedule} className="bg-indigo-600 text-white flex items-center gap-2">
            <Play className="w-4 h-4 fill-current" /> Generate
          </Button>
          <Button onClick={handleValidate} variant="secondary">
            Validate
          </Button>
        </div>
      </div>

      {/* Main Schedule Area */}
      <div
        className="bg-white rounded-xl shadow-sm border border-slate-200 relative"
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={handleContainerMouseLeave}
      >
        {/* Crosshair Guide (imperatively positioned — no re-render on mousemove) */}
        <Crosshair lineRef={crosshairRef} />

        {/* Current Time Indicator */}
        <CurrentTimeIndicator
          currentTime={currentTime}
          getLeftPos={getLeftPos}
          containerWidth={containerWidth}
        />

        {/* Break Guide Line (during drag) */}
        <BreakGuideLine
          dragState={dragState}
          minWidth={minWidth}
          getLeftPos={getLeftPos}
        />

        {/* Timeline Header */}
        <TimelineHeader
          hours={hours}
          hourWidth={hourWidth}
          startHour={startHour}
          sortByTime={sortByTime}
          onToggleSort={() => setSortByTime(!sortByTime)}
        />

        {/* Employee Rows */}
        <div className="w-full relative">
          {/* Validation Warning Zones (dismissed warnings hidden) */}
          <ValidationOverlay
            validationErrors={visibleErrors}
            startHour={startHour}
            hourWidth={hourWidth}
          />
          {employees.length === 0 && (
            <div className="p-12 text-center text-slate-400">No employees.</div>
          )}

          {displayedEmployees.map(emp => (
            <TimelineRow
              key={emp.id}
              emp={emp}
              empSchedule={schedule.find(s => s.employeeId === emp.id)}
              schedule={schedule}
              hours={hours}
              hourWidth={hourWidth}
              minWidth={minWidth}
              startHour={startHour}
              endHour={endHour}
              dragState={dragState}
              hoveredBreakId={hoveredBreakId}
              swapCandidate={swapCandidate}
              availableEmployees={availableEmployees}
              roleColors={roleColors}
              getLeftPos={getLeftPos}
              onRemoveEmployee={removeEmployee}
              onSwapCandidate={setSwapCandidate}
              onSwapEmployee={handleSwapEmployee}
              onCreateMouseDown={handleCreateMouseDown}
              onShiftMoveStart={handleShiftMoveStart}
              onShiftResizeStart={handleShiftResizeStart}
              onBreakMouseDown={handleBreakMouseDown}
              onHoverBreak={setHoveredBreakId}
              onLeaveBreak={() => setHoveredBreakId(null)}
              onUnlinkBreak={unlinkBreak}
              onMergeBreaks={handleMergeBreaks}
              selectedBreak={selectedBreak}
              onSelectBreak={setSelectedBreak}
            />
          ))}
        </div>

        {/* Add Row Section */}
        <div className="relative border-t border-slate-100 p-2 bg-slate-50/50" ref={addMenuRef}>
          <div
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="w-full flex items-center p-2 rounded-md hover:bg-slate-100 cursor-pointer group"
          >
            <div className="shrink-0 flex items-center justify-center" style={{ width: SIDEBAR_WIDTH }}>
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
                      onClick={() => handleAddEmployee(emp)}
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
                <div className="shrink-0 bg-white border-r border-slate-100" style={{ width: SIDEBAR_WIDTH }} />
                <div className="flex-1">
                  <LaborChart
                    employees={employees}
                    schedule={schedule}
                    startHour={startHour}
                    endHour={endHour}
                    rules={coverageRules}
                    roleColors={roleColors}
                    width={timelineWidth}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validation Errors & Activity Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(visibleErrors.length > 0 || dismissedCount > 0) && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex flex-col max-h-60">
            <div className="p-3 border-b border-amber-200 bg-amber-100/50 rounded-t-xl sticky top-0 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Schedule Conflicts
                <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                  {visibleErrors.length}
                </span>
              </h3>
              <div className="flex items-center gap-3 text-xs">
                {dismissedCount > 0 && (
                  <button onClick={restoreWarnings} className="text-amber-700 hover:text-amber-900 underline" title="Show dismissed warnings again">
                    Show {dismissedCount} dismissed
                  </button>
                )}
                {visibleErrors.length > 0 && (
                  <button onClick={dismissAllWarnings} className="text-amber-700 hover:text-amber-900 font-medium" title="Hide all current warnings (they reappear if the problem changes)">
                    Dismiss all
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {visibleErrors.length === 0 && (
                <div className="text-sm text-amber-700/70 italic">All warnings dismissed.</div>
              )}
              {visibleErrors.map((err) => (
                <div
                  key={warningKey(err)}
                  className={`group/warn flex items-start gap-2 text-sm p-2 rounded ${
                    err.kind === 'break' ? 'text-red-700 bg-white/70' : 'text-amber-700 bg-white/40'
                  }`}
                >
                  <span className={`font-mono px-1 rounded h-fit text-xs font-bold ${err.kind === 'break' ? 'bg-red-100' : 'bg-amber-100'}`}>{err.time}</span>
                  <span className="flex-1">{err.message}</span>
                  <button
                    onClick={() => dismissWarning(err)}
                    className="opacity-40 group-hover/warn:opacity-100 hover:text-slate-900 text-xs px-1"
                    title="Dismiss this warning"
                    aria-label="Dismiss warning"
                  >✕</button>
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
            {activityLog.length === 0 && (
              <div className="text-sm text-slate-400 italic">No activity yet.</div>
            )}
            {activityLog.map((log) => (
              <div key={log.id} className="text-sm border-l-2 pl-2 py-0.5 border-indigo-300">
                <span className="text-xs text-slate-400 block">{log.timestamp.toLocaleTimeString()}</span>
                <span className={`text-slate-700 ${log.type === 'warning' ? 'text-amber-600 font-medium' : ''}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
