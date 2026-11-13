// ============================================================================
// Schedule (de)serialization
// ----------------------------------------------------------------------------
// Schedules are stored in Supabase as JSON (schedules.schedule_data), so break
// Date objects come back as ISO strings ("2026-11-13T17:00:00.000Z"), and
// merged breaks may carry 'HH:mm' strings. The timeline treats break times as
// TIME OF DAY measured against shifts parsed on *today* (e.g. BreakBlock does
// differenceInMinutes(brk.startTime, shiftStart)), so restored breaks must be
// re-anchored onto the reference day with the same local hours/minutes —
// otherwise a schedule saved yesterday would render a full day off.
//
// Pure functions, no framework imports — testable in Node (test_schedule_restore.mjs).
// ============================================================================

const pad = (n) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD for a Date (NOT toISOString, which is UTC). */
export const toLocalDateKey = (date = new Date()) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Convert a stored break time (Date | ISO string | 'HH:mm') to a Date on
 * `refDate`'s calendar day with the same local hours/minutes.
 * Returns null if the value can't be interpreted.
 */
export const reviveTime = (value, refDate = new Date()) => {
    let hours;
    let minutes;

    if (value instanceof Date) {
        if (isNaN(value)) return null;
        hours = value.getHours();
        minutes = value.getMinutes();
    } else if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
        [hours, minutes] = value.split(':').map(Number);
    } else if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        if (isNaN(d)) return null;
        hours = d.getHours();
        minutes = d.getMinutes();
    } else {
        return null;
    }

    const out = new Date(refDate);
    out.setHours(hours, minutes, 0, 0);
    return out;
};

const reviveBreak = (brk, refDate) => {
    const startTime = reviveTime(brk.startTime, refDate);
    const endTime = reviveTime(brk.endTime, refDate);
    if (!startTime || !endTime) return null;

    const revived = { ...brk, startTime, endTime };
    if (Array.isArray(brk.subBreaks)) {
        revived.subBreaks = brk.subBreaks.map(sb => reviveBreak(sb, refDate)).filter(Boolean);
    }
    return revived;
};

/**
 * Restore a stored schedule: [{ employeeId, breaks: [...] }] with every break
 * time re-anchored onto refDate. Malformed entries/breaks are dropped rather
 * than crashing the timeline.
 */
export const reviveSchedule = (data, refDate = new Date()) => {
    if (!Array.isArray(data)) return [];
    return data
        .filter(entry => entry && entry.employeeId)
        .map(entry => ({
            ...entry,
            breaks: (Array.isArray(entry.breaks) ? entry.breaks : [])
                .map(b => reviveBreak(b, refDate))
                .filter(Boolean)
        }));
};
