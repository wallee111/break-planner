// Scheduler/validation regression tests.
// Run: node test_validation.mjs
//
// Reproduces the "conflict warnings won't go away" report: a realistic team,
// the default break + coverage rules, generate → validate.

import { generateSchedule, validateSchedule } from './src/utils/scheduler.js';
import { INITIAL_RULES, INITIAL_COVERAGE_RULES } from './src/utils/initialData.js';

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

const team = [
    { id: 'alex', name: 'Alex', roles: ['Manager'], startTime: '10:00', endTime: '18:30' },
    { id: 'sam', name: 'Sam', roles: ['Product Guide'], startTime: '11:00', endTime: '19:30' },
    { id: 'will', name: 'Will', roles: ['Product Guide'], startTime: '14:00', endTime: '19:00' }
];

const byKind = (warnings, kind) => warnings.filter(w => w.kind === kind);
const fmt = (ws) => ws.map(w => `${w.time} ${w.message}`).join(' | ');

console.log('\n— generator honours coverage rules —');
const blind = generateSchedule(team, INITIAL_RULES); // old call: no coverage rules
const aware = generateSchedule(team, INITIAL_RULES, INITIAL_COVERAGE_RULES);
const blindWarnings = validateSchedule(blind, team, INITIAL_COVERAGE_RULES);
const awareWarnings = validateSchedule(aware, team, INITIAL_COVERAGE_RULES);
console.log(`  (blind: ${blindWarnings.length} warnings, coverage-aware: ${awareWarnings.length})`);
check('coverage-aware generation causes no more break conflicts than blind generation',
    byKind(awareWarnings, 'break').length <= byKind(blindWarnings, 'break').length,
    `aware=${byKind(awareWarnings, 'break').length} blind=${byKind(blindWarnings, 'break').length}`);

console.log('\n— warnings are classified —');
check('every warning has a kind', awareWarnings.every(w => w.kind === 'staffing' || w.kind === 'break'),
    JSON.stringify(awareWarnings.slice(0, 2)));
const staffing = byKind(awareWarnings, 'staffing');
check('10:00–10:45 flagged as a staffing gap (only Alex scheduled)',
    ['10:00', '10:15', '10:30', '10:45'].every(t => staffing.some(w => w.time === t && w.message.includes('[Any]'))),
    fmt(staffing));
check('staffing gaps are not reported as break conflicts',
    !byKind(awareWarnings, 'break').some(w => ['10:00', '10:15', '10:30', '10:45'].includes(w.time) && w.message.includes('[Any]')));
check('18:30–19:15 with no manager scheduled is a staffing gap',
    staffing.some(w => w.time === '18:30' && w.message.includes('[Manager]')), fmt(staffing));

console.log('\n— a fully covered day validates clean —');
const fullTeam = [
    { id: 'm1', name: 'M1', roles: ['Manager'], startTime: '09:00', endTime: '17:00' },
    { id: 'm2', name: 'M2', roles: ['Manager'], startTime: '09:00', endTime: '17:00' },
    { id: 'g1', name: 'G1', roles: ['Product Guide'], startTime: '09:00', endTime: '17:00' },
    { id: 'g2', name: 'G2', roles: ['Product Guide'], startTime: '09:00', endTime: '17:00' }
];
const fullSched = generateSchedule(fullTeam, INITIAL_RULES, INITIAL_COVERAGE_RULES);
const fullWarnings = validateSchedule(fullSched, fullTeam, INITIAL_COVERAGE_RULES);
check('two managers + two guides → zero warnings', fullWarnings.length === 0, fmt(fullWarnings));

console.log('\n— validation counts string break times (merged / restored breaks) —');
// One guide covering alone with a manager: a guide break must register
const pair = [
    { id: 'm', name: 'M', roles: ['Manager'], startTime: '09:00', endTime: '17:00' },
    { id: 'g', name: 'G', roles: ['Product Guide'], startTime: '09:00', endTime: '17:00' }
];
const stringBreaks = [
    { employeeId: 'm', breaks: [] },
    { employeeId: 'g', breaks: [{ id: 'x', type: 'merged', startTime: '12:00', endTime: '12:30', duration: 30 }] }
];
let threw = null;
let stringWarnings = [];
try { stringWarnings = validateSchedule(stringBreaks, pair, INITIAL_COVERAGE_RULES); } catch (e) { threw = e.message; }
check('no crash on HH:mm string break times', threw === null, threw);
check('string-time break is counted as off the floor (12:00 and 12:15 flagged)',
    ['12:00', '12:15'].every(t => stringWarnings.some(w => w.time === t && w.kind === 'break')),
    fmt(stringWarnings));
check('break boundary is exclusive (12:30 not flagged)', !stringWarnings.some(w => w.time === '12:30'), fmt(stringWarnings));

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
