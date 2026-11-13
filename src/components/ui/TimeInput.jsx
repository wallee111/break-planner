import React, { useState, useEffect } from 'react';
import { setHours, startOfDay, format } from 'date-fns';
import { Input } from './Input';

/**
 * Smart time input component that accepts flexible time formats.
 * Supports: 1, 1:00, 1am, 1:00pm, etc.
 * Handles overnight times with (+1) indicator.
 */
export const TimeInput = ({ value, onChange, minVal, className = '' }) => {
  const [text, setText] = useState('');

  // Sync text with external value prop on mount/update
  useEffect(() => {
    if (value === undefined || value === null || isNaN(value)) {
      setText('');
      return;
    }
    let h = value;
    const isNextDay = h >= 24;
    if (h >= 24) h -= 24;

    const d = setHours(startOfDay(new Date()), h);
    if (isNaN(d.getTime())) {
      setText('');
      return;
    }

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
      const period = match[3]; // a, p, am, pm

      if (period && (period.startsWith('p'))) {
        if (h < 12) h += 12;
      } else if (period && (period.startsWith('a'))) {
        if (h === 12) h = 0;
      }

      // Handle "Next Day" heuristic if minVal is present (for End Time)
      if (minVal !== undefined) {
        if (h < minVal) {
          h += 24;
        }
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
      className={`w-24 h-8 text-center bg-white text-xs font-medium ${className}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
