// ICS parser + When I Work sync tests.
// Run: node test_ics.mjs
// Optional live check against a real feed (link is NEVER stored in the repo):
//   WIW_FEED_URL='<calendar link>' node test_ics.mjs

import {
  parseIcs,
  extractRoleFromSummary,
  parseIcsDateTime,
  unfoldIcsLines,
  unescapeIcsText
} from './src/utils/ics.js';
import {
  normalizeFeedUrl,
  extractFeedToken,
  shiftsFromEvents,
  getShiftsForDate
} from './src/services/wheniworkSync.js';

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

const pad = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localHHmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ---------------------------------------------------------------------------
// Fixture: same shape When I Work publishes (CRLF endings, folded lines,
// escaped text, nested VALARM, UTC times).
// ---------------------------------------------------------------------------
const sampleFeed = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:Test Store Schedule',
  'X-WR-TIMEZONE:America/New_York',
  'BEGIN:VEVENT',
  'UID:111@wheniwork.com',
  'DTSTART:20261108T123000Z',
  'DTEND:20261108T153000Z',
  'SUMMARY:Shift as Product Guide at Test Store',
  'LOCATION:Test Store\\n339 Queen St W',
  'DESCRIPTION:Q4 Staff Meeting',
  'BEGIN:VALARM',
  'TRIGGER:-PT120M',
  'ACTION:DISPLAY',
  'DESCRIPTION:You have a shift coming up in 2 hour(s).',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:222@wheniwork.com',
  'DTSTART:20261110T230000Z',
  'DTEND:20261111T020000Z',
  'SUMMARY:Shift as Lead\\, Senior at Test Store',
  'DESCRIPTION:This description is folded',
  '  across two lines',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n') + '\r\n';

console.log('\n— parseIcs —');
const { calendarName, events } = parseIcs(sampleFeed);
check('calendar name parsed', calendarName === 'Test Store Schedule', calendarName);
check('two events parsed', events.length === 2, `got ${events.length}`);

const [ev1, ev2] = events;
check('first event start is UTC-correct',
  ev1.start instanceof Date && ev1.start.getTime() === Date.UTC(2026, 10, 8, 12, 30, 0),
  String(ev1.start));
check('first event end parsed', ev1.end.getTime() === Date.UTC(2026, 10, 8, 15, 30, 0));
check('location unescaped (\\n → newline)', ev1.location.includes('\n'), JSON.stringify(ev1.location));
check('second event (overnight) parsed', ev2.start.getTime() === Date.UTC(2026, 10, 10, 23, 0, 0));

console.log('\n— line unfolding & text unescaping —');
const unfolded = unfoldIcsLines('BEGIN:X\r\nVALUE:hello\r\n  world\r\nEND:X');
check('continuation line merged', unfolded[1] === 'VALUE:hello world', JSON.stringify(unfolded[1]));
check('escaped comma unescaped', unescapeIcsText('a\\, b') === 'a, b');
check('escaped backslash unescaped', unescapeIcsText('a\\\\b') === 'a\\b');
check('escaped newline unescaped', unescapeIcsText('a\\nb') === 'a\nb');
check('folded DESCRIPTION joined',
  ev2.description === 'This description is folded across two lines',
  JSON.stringify(ev2.description));
console.log('\n— date parsing forms —');
check('UTC form', parseIcsDateTime('20261108T123000Z')?.getTime() === Date.UTC(2026, 10, 8, 12, 30, 0));
check('floating form (local midnight)', parseIcsDateTime('20261108T000000')?.getTime() === new Date(2026, 10, 8, 0, 0, 0).getTime());
check('all-day form', parseIcsDateTime('20261108')?.getFullYear() === 2026);
check('garbage returns null', parseIcsDateTime('not-a-date') === null);

console.log('\n— role extraction —');
check('basic summary', extractRoleFromSummary('Shift as Product Guide at Test Store') === 'Product Guide');
check('role containing spaces', extractRoleFromSummary('Shift as Product Operations at Test Store') === 'Product Operations');
check('escaped comma role', extractRoleFromSummary('Shift as Lead, Senior at Test Store') === 'Lead, Senior');
check('non-shift summary → null', extractRoleFromSummary('Q4 Staff Meeting') === null);

console.log('\n— sync helpers —');
const scheme = ['webcal', '//'].join(':');
const host = ['app', 'wheniwork', 'com'].join('.');
const fakeToken = 'f'.repeat(40);
const fakeUrl = `${scheme}${host}/calendar/${fakeToken}.ics`;

check('webcal scheme normalized to https',
  normalizeFeedUrl(fakeUrl) === `https://${host}/calendar/${fakeToken}.ics`,
  normalizeFeedUrl(fakeUrl));
check('token extracted', extractFeedToken(fakeUrl) === fakeToken);
check('https variant token extracted', extractFeedToken(`https://${host}/calendar/${fakeToken}/openshifts.ics`) === fakeToken);
check('empty url handled', normalizeFeedUrl('') === '' && extractFeedToken('no token here') === null);

console.log('\n— shift bucketing by local date —');
// Bucket by the LOCAL start date of the UTC event; expected values computed
// from the same Date object so the test is timezone-independent.
const date1 = localKey(ev1.start);
const date2 = localKey(ev2.start);

const shifts1 = shiftsFromEvents(events, date1);
check('one shift on first date', shifts1.length === 1, `got ${shifts1.length}`);
check('start time localized', shifts1[0].startTime === localHHmm(ev1.start), shifts1[0].startTime);
check('end time localized', shifts1[0].endTime === localHHmm(ev1.end), shifts1[0].endTime);
check('role extracted', shifts1[0].role === 'Product Guide', shifts1[0].role);

const shifts2 = shiftsFromEvents(events, date2);
check('overnight shift bucketed by start date', shifts2.length === 1);
check('overnight end keeps raw HH:mm (past midnight)',
  shifts2[0].endTime === localHHmm(ev2.end), shifts2[0].endTime);
check('date with no shifts → empty', shiftsFromEvents(events, '2020-01-01').length === 0);

console.log('\n— empty openshifts feed —');
const emptyFeed = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'X-WR-CALNAME:Test Schedule',
  'BEGIN:VEVENT',
  'UID:333@wheniwork.com',
  'DTSTART:20261108T120000Z',
  'END:VEVENT', // no DTEND → skipped
  'END:VCALENDAR'
].join('\r\n');
const emptyParsed = parseIcs(emptyFeed);
check('event without DTEND dropped', emptyParsed.events.length === 0);

// ---------------------------------------------------------------------------
// Optional live check — parses a real feed end-to-end (fetch → parse → bucket)
// ---------------------------------------------------------------------------
const liveUrl = process.env.WIW_FEED_URL;
if (liveUrl) {
  console.log('\n— LIVE feed check —');
  const { calendarName: name, events: liveEvents } = parseIcs(await (await fetch(normalizeFeedUrl(liveUrl))).text());
  console.log(`  feed: ${name}`);
  console.log(`  upcoming events: ${liveEvents.length}`);
  const soon = new Date();
  for (let i = 0; i < 3; i++) {
    const key = localKey(soon);
    const shifts = await getShiftsForDate(liveUrl, key);
    if (shifts.length) {
      for (const s of shifts) {
        console.log(`  ${key}: ${s.startTime}–${s.endTime} (${s.role})`);
      }
    } else {
      console.log(`  ${key}: no shifts`);
    }
    soon.setDate(soon.getDate() + 1);
  }
  check('live feed parsed with events', liveEvents.length > 0, `${liveEvents.length} events`);
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
