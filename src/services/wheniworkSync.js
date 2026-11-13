// ============================================================================
// When I Work calendar sync service
// ----------------------------------------------------------------------------
// Fetches an employee's private When I Work ICS feed, parses it, and returns
// the shifts for a given date. Feed URLs contain private tokens — they are
// stored per roster member in the database (roster.feed_url), never in code.
//
// CORS: When I Work's calendar endpoint does not send CORS headers, so a
// direct browser fetch always fails. fetchIcs() therefore:
//   - in the browser: goes straight to the proxy `<base>/<token>.ics`,
//     where <base> is VITE_WIW_PROXY_URL (production: the Supabase Edge
//     Function `wiw-proxy`) or `/wiw-proxy` (dev: the Vite proxy);
//   - outside the browser (Node tests): fetches the feed directly.
// ============================================================================

import { parseIcs, extractRoleFromSummary, toLocalHHmm } from '../utils/ics.js';

/** webcal:// is an alias for https:// — normalize before fetching. */
export const normalizeFeedUrl = (url) => {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('webcal://')) return 'https://' + trimmed.slice('webcal://'.length);
    return trimmed;
};

/** Pull the private feed token out of any WIW calendar URL shape. */
export const extractFeedToken = (url) => {
    const normalized = normalizeFeedUrl(url).split('?')[0];
    const m = /([0-9a-f]{32,64})/i.exec(normalized);
    return m ? m[1] : null;
};

/** Local YYYY-MM-DD key for a Date (shifts are bucketed by local start date). */
const toLocalDateKey = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * When I Work answers unknown/revoked feed tokens with HTTP 200 and a plain
 * text body ("That calendar does not exist."), not a 404 — so a bad link
 * would parse as an empty calendar and silently show the person as "not
 * scheduled". Reject anything that isn't actually an iCalendar document.
 */
export const assertIcsBody = (text) => {
    if (!/^\s*BEGIN:VCALENDAR/i.test(String(text || ''))) {
        const snippet = String(text || '').trim().slice(0, 60);
        throw new Error(`Calendar link not found or revoked${snippet ? ` ("${snippet}")` : ''} — re-copy it from When I Work`);
    }
    return text;
};

/**
 * Fetch the raw ICS text for a feed URL. Direct fetch first, proxy fallback.
 * Throws with a human-readable message on failure.
 */
export const fetchIcs = async (feedUrl) => {
    const url = normalizeFeedUrl(feedUrl);
    if (!url) throw new Error('No calendar feed URL provided');

    // 1. Direct — only outside the browser (Node/tests). In a browser When I
    // Work's missing CORS headers make this fail every time, and the blocked
    // request prints a red CORS error in the console on every sync.
    const inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!inBrowser) {
        try {
            const res = await fetch(url);
            if (res.ok) return assertIcsBody(await res.text());
            if (res.status === 404) throw new Error('Feed not found — check the calendar link');
        } catch (e) {
            if (/not found|revoked/i.test(e.message)) throw e;
            // Otherwise fall through to the proxy
        }
    }

    // 2. Same-origin proxy (Vite dev server / Supabase edge function).
    // VITE_WIW_PROXY_URL points at a deployed proxy base for production.
    const token = extractFeedToken(url);
    if (!token) throw new Error('Unrecognized calendar link format');
    const proxyBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WIW_PROXY_URL) || '/wiw-proxy';
    const res = await fetch(`${proxyBase}/${token}.ics`);
    if (!res.ok) throw new Error(`Feed fetch failed (${res.status})`);
    return assertIcsBody(await res.text());
};

/**
 * Filter parsed feed events down to shift objects starting (locally) on the
 * given date. Pure — separated from getShiftsForDate so it is testable in Node.
 * Returns [{ startTime: 'HH:mm', endTime: 'HH:mm', role, summary,
 *            description, location, uid }], sorted by start time.
 * Note: shifts crossing midnight keep their raw end HH:mm (e.g. 23:00→01:00);
 * the planner treats times as time-of-day, same as manual entry.
 */
export const shiftsFromEvents = (events, dateStr) => {
    const target = String(dateStr);

    return events
        .filter(ev => ev.start && toLocalDateKey(ev.start) === target)
        .map(ev => ({
            uid: ev.uid,
            startTime: toLocalHHmm(ev.start),
            endTime: toLocalHHmm(ev.end),
            role: extractRoleFromSummary(ev.summary),
            summary: ev.summary,
            description: ev.description,
            location: ev.location
        }))
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
};

/** All shifts from a feed that start (locally) on the given date. */
export const getShiftsForDate = async (feedUrl, dateStr) => {
    const { events } = parseIcs(await fetchIcs(feedUrl));
    return shiftsFromEvents(events, dateStr);
};

/**
 * Sync a roster against a date: for every roster member that has a feed URL,
 * fetch their shifts for that date. Never throws — per-employee errors are
 * returned in the result entries.
 *
 * @returns [{ employee, shifts: [...], error: string | null }]
 */
export const syncRosterForDate = async (rosterItems, dateStr) => {
    const withFeeds = rosterItems.filter(r => r.feedUrl);

    return Promise.all(withFeeds.map(async (employee) => {
        try {
            const shifts = await getShiftsForDate(employee.feedUrl, dateStr);
            return { employee, shifts, error: null };
        } catch (e) {
            return { employee, shifts: [], error: e.message || String(e) };
        }
    }));
};

/**
 * Match store-feed events to roster members for a date. A store-wide feed
 * (e.g. the manager's full-schedule WIW link) contains everyone's shifts in
 * one calendar; we attribute each event to the roster member whose name
 * appears in the event's summary or description (case-insensitive). This
 * avoids depending on any particular WIW summary format.
 *
 * Pure — separated from syncStoreFeedForDate so it is testable in Node.
 *
 * @returns [{ employee, shift: { startTime, endTime, role }, matched: boolean }]
 */
export const storeShiftsFromEvents = (events, roster, dateStr) => {
    const target = String(dateStr);

    return events
        .filter(ev => ev.start && toLocalDateKey(ev.start) === target)
        .map(ev => {
            const haystack = `${ev.summary || ''} ${ev.description || ''}`.toLowerCase();
            const match = roster.find(r =>
                r.name && r.name.trim().length > 1 && haystack.includes(r.name.trim().toLowerCase())
            );

            return {
                employee: match || null,
                matched: !!match,
                shift: {
                    startTime: toLocalHHmm(ev.start),
                    endTime: toLocalHHmm(ev.end),
                    role: extractRoleFromSummary(ev.summary) || (match ? match.defaultRole : null),
                    summary: ev.summary,
                    description: ev.description
                }
            };
        });
};

/** Fetch a store-wide feed and match its shifts for a date against a roster. */
export const syncStoreFeedForDate = async (storeFeedUrl, roster, dateStr) => {
    const { events } = parseIcs(await fetchIcs(storeFeedUrl));
    return storeShiftsFromEvents(events, roster, dateStr);
};
