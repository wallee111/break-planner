// Schedule restore tests — a saved schedule must come back on load exactly
// as it was planned. Run: node test_schedule_restore.mjs

import { reviveSchedule, reviveTime, toLocalDateKey } from './src/utils/scheduleSerialization.js';
import { generateSchedule, validateSchedule } from './src/utils/scheduler.js';
import { INITIAL_RULES, INITIAL_COVERAGE_RULES } from './src/utils/initialData.js';

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};
const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const team = [
    { id: 'm', name: 'M', roles: ['Manager'], startTime: '09:00', endTime: '17:00' },
    { id: 'g', name: 'G', roles: ['Product Guide'], startTime: '10:00', endTime: '18:00' }
];

console.log('\n— round trip through JSON (what Supabase stores) —');
const original = generateSchedule(team, INITIAL_RULES, INITIAL_COVERAGE_RULES);
const stored = JSON.parse(JSON.stringify(original)); // Dates → ISO strings
check('stored break times are strings (the bug: they were never revived)', typeof stored[0].breaks[0].startTime === 'string');

const restored = reviveSchedule(stored);
check('restored break times are Dates', restored.every(e => e.breaks.every(b => b.startTime instanceof Date && b.endTime instanceof Date)));
check('same entries and break counts', restored.length === original.length &&
    restored.every((e, i) => e.employeeId === original[i].employeeId && e.breaks.length === original[i].breaks.length));
check('break times-of-day preserved exactly',
    restored.every((e, i) => e.breaks.every((b, j) =>
        hm(b.startTime) === hm(original[i].breaks[j].startTime) && hm(b.endTime) === hm(original[i].breaks[j].endTime))));
check('break ids/types/durations preserved',
    restored.every((e, i) => e.breaks.every((b, j) => {
        const o = original[i].breaks[j];
        return b.id === o.id && b.type === o.type && b.duration === o.duration;
    })));
check('validation of restored schedule matches the original',
    JSON.stringify(validateSchedule(restored, team, INITIAL_COVERAGE_RULES)) ===
    JSON.stringify(validateSchedule(original, team, INITIAL_COVERAGE_RULES)));

console.log('\n— schedule saved on a previous day —');
const yesterdayIso = JSON.parse(JSON.stringify([{ employeeId: 'g', breaks: [{ id: 'b', type: 'paid', duration: 15,
    startTime: new Date(2026, 10, 12, 13, 0), endTime: new Date(2026, 10, 12, 13, 15) }] }]));
const today = new Date(2026, 10, 13, 8, 0);
const reanchored = reviveSchedule(yesterdayIso, today);
const rb = reanchored[0].breaks[0];
check('re-anchored onto the reference day', toLocalDateKey(rb.startTime) === '2026-11-13', toLocalDateKey(rb.startTime));
check('keeps 13:00–13:15 time of day', hm(rb.startTime) === '13:00' && hm(rb.endTime) === '13:15', `${hm(rb.startTime)}-${hm(rb.endTime)}`);

console.log('\n— merged breaks + malformed data —');
const mergedStored = [{ employeeId: 'g', breaks: [{ id: 'mg', type: 'merged', duration: 45,
    startTime: '2026-11-13T17:00:00.000Z', endTime: '12:45',
    subBreaks: [
        { id: 's1', type: 'meal', duration: 30, startTime: '2026-11-13T17:00:00.000Z', endTime: '2026-11-13T17:30:00.000Z' },
        { id: 's2', type: 'paid', duration: 15, startTime: '12:30', endTime: '12:45' }
    ] }] }];
const mr = reviveSchedule(mergedStored, today)[0].breaks[0];
check('HH:mm endTime revived', mr.endTime instanceof Date && hm(mr.endTime) === '12:45', String(mr.endTime));
check('subBreaks revived too', mr.subBreaks.length === 2 && mr.subBreaks.every(s => s.startTime instanceof Date));

const junk = reviveSchedule([null, { breaks: [] }, { employeeId: 'x', breaks: [{ startTime: 'garbage', endTime: 'nope' }] }]);
check('malformed entries/breaks dropped without throwing', junk.length === 1 && junk[0].breaks.length === 0, JSON.stringify(junk));
check('non-array input → empty schedule', reviveSchedule(null).length === 0 && reviveSchedule({}).length === 0);
check('reviveTime rejects garbage', reviveTime('garbage') === null && reviveTime(undefined) === null);

console.log('\n— local date key (save date) —');
// 21:30 Toronto on Nov 13 is already Nov 14 in UTC — the save date must stay Nov 13
const lateEvening = new Date(2026, 10, 13, 21, 30);
check('local key is the local calendar day', toLocalDateKey(lateEvening) === '2026-11-13', toLocalDateKey(lateEvening));

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
