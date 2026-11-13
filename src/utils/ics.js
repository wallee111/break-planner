// ============================================================================
// ICS (iCalendar) parsing utilities
// ----------------------------------------------------------------------------
// Parses When I Work calendar feeds into plain JS objects. Pure functions —
// no fetch, no DOM, no framework imports — so this module can be unit-tested
// in Node directly (see test_ics.mjs).
// ============================================================================

/**
 * Unfold folded iCalendar lines (RFC 5545 §3.1): a line starting with a space
 * or tab is a continuation of the previous line.
 */
export const unfoldIcsLines = (text) => {
    const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const lines = [];
    for (const rawLine of rawLines) {
        if ((rawLine.startsWith(' ') || rawLine.startsWith('\t')) && lines.length > 0) {
            lines[lines.length - 1] += rawLine.slice(1);
        } else {
            lines.push(rawLine);
        }
    }
    return lines;
};

/** Unescape iCalendar text per RFC 5545 §3.3.11 (\\n, \\,, \\; and \\\\). */
export const unescapeIcsText = (text) => {
    if (!text) return '';
    return text
        .replace(/\\n/gi, '\n')
        .replace(/\\N/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
};

/**
 * Parse an iCalendar date-time value into a Date.
 * Handles the forms When I Work emits:
 *   - UTC:        20261108T123000Z
 *   - Floating:   20261108T123000  (interpreted as local time)
 *   - All-day:   20261108  (VALUE=DATE, local midnight)
 * Timezone-aware values (TZID=...) are treated as floating/local — fine for
 * WIW feeds, which publish in UTC.
 */
export const parseIcsDateTime = (value) => {
    const m = String(value).trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, h = '0', mi = '0', s = '0', zulu] = m;
    if (zulu) {
        return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
    }
    return new Date(+y, +mo - 1, +d, +h, +mi, +s);
};

const splitProperty = (line) => {
    // NAME;PARAM=VAL;PARAM2=VAL2:value
    const idx = line.indexOf(':');
    if (idx === -1) return null;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...params] = left.split(';');
    return { name: name.toUpperCase(), params, value };
};

/**
 * Parse an entire iCalendar document into:
 *   { calendarName, events: [{ uid, summary, description, location, start, end }] }
 * Multi-day all-day events and non-VEVENT components are ignored.
 */
export const parseIcs = (text) => {
    const lines = unfoldIcsLines(text);
    const events = [];
    let calendarName = null;
    let current = null;

    for (const line of lines) {
        if (!line) continue;

        if (/^BEGIN:VEVENT$/i.test(line)) {
            current = { uid: null, summary: '', description: '', location: '', start: null, end: null };
            continue;
        }
        if (/^END:VEVENT$/i.test(line)) {
            if (current && current.start && current.end) {
                events.push(current);
            }
            current = null;
            continue;
        }
        if (current === null) {
            const prop = splitProperty(line);
            if (prop && prop.name === 'X-WR-CALNAME') {
                calendarName = unescapeIcsText(prop.value);
            }
            continue;
        }

        const prop = splitProperty(line);
        if (!prop) continue;

        switch (prop.name) {
            case 'UID':
                current.uid = prop.value;
                break;
            case 'SUMMARY':
                current.summary = unescapeIcsText(prop.value);
                break;
            case 'DESCRIPTION':
                current.description = unescapeIcsText(prop.value);
                break;
            case 'LOCATION':
                current.location = unescapeIcsText(prop.value);
                break;
            case 'DTSTART':
                current.start = parseIcsDateTime(prop.value);
                break;
            case 'DTEND':
                current.end = parseIcsDateTime(prop.value);
                break;
            default:
                break;
        }
    }

    return { calendarName, events };
};

/**
 * When I Work shift summaries look like:
 *   "Shift as Product Guide at Arc'teryx Toronto Store"
 * Returns the role ("Product Guide"), or null if the summary doesn't match.
 */
export const extractRoleFromSummary = (summary) => {
    const m = /^Shift as (.+?) at /.exec(summary || '');
    return m ? m[1].trim() : null;
};

/** Formats a Date as local HH:mm (24h). */
export const toLocalHHmm = (date, formatFn) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return null;
    if (typeof formatFn === 'function') return formatFn(date, 'HH:mm');
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
