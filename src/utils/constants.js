/**
 * Shared constants for the Break Planner application.
 */

// Layout constants
export const SIDEBAR_WIDTH = 192; // w-48 = 12rem = 192px
export const ROW_HEIGHT = 64; // h-16 = 4rem = 64px

// Time constants
export const SNAP_INTERVAL_MINUTES = 15;
export const MIN_SHIFT_DURATION_MINUTES = 15;
export const MIN_GAP_BETWEEN_BREAKS_MINUTES = 60;

// Default view range
export const DEFAULT_VIEW_RANGE = { start: 8, end: 20 };

// Colors
export const DEFAULT_ROLE_COLOR = '#6366f1';
export const DEFAULT_AVATAR_COLOR = '#e2e8f0';

// Break type colors
export const BREAK_COLORS = {
  paid: {
    bg: 'bg-indigo-100',
    border: 'border-indigo-200',
    text: 'text-indigo-700'
  },
  unpaid: {
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    text: 'text-orange-700'
  },
  meal: {
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    text: 'text-orange-700'
  },
  merged: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-400',
    text: 'text-indigo-700'
  }
};

// Drag operation types
export const DRAG_TYPES = {
  CREATE_SHIFT: 'CREATE_SHIFT',
  MOVE_SHIFT: 'MOVE_SHIFT',
  RESIZE_START: 'RESIZE_START',
  RESIZE_END: 'RESIZE_END',
  MOVE_BREAK: 'MOVE_BREAK'
};
