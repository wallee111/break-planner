// Parameters draft (Save / Discard) tests.
// Run: node test_parameters.mjs

import {
    createDraft, isDraftDirty, validateDraft,
    draftAddRole, draftSetRoleColor, draftRenameRole, draftDeleteRole,
    applyRoleOpsToEmployee, applyRoleOpsToRosterItem
} from './src/utils/parameterDraft.js';
import { INITIAL_RULES, INITIAL_COVERAGE_RULES, INITIAL_ROLE_COLORS } from './src/utils/initialData.js';

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

const saved = { rules: INITIAL_RULES, coverageRules: INITIAL_COVERAGE_RULES, roleColors: INITIAL_ROLE_COLORS };

console.log('— dirty tracking —');
const fresh = createDraft(saved);
check('fresh draft is clean', !isDraftDirty(fresh, saved));
check('no draft is clean', !isDraftDirty(null, saved));
check('draft is a copy (editing it leaves saved untouched)', (() => { const d = createDraft(saved); d.rules[0].paidBreaks = 9; return INITIAL_RULES[0].paidBreaks === 1; })());

const edited = { ...fresh, rules: fresh.rules.map((r, i) => i === 0 ? { ...r, paidBreaks: 2 } : r) };
check('changing a number makes it dirty', isDraftDirty(edited, saved));
const reverted = { ...edited, rules: edited.rules.map((r, i) => i === 0 ? { ...r, paidBreaks: 1 } : r) };
check('changing it back makes it clean again', !isDraftDirty(reverted, saved));
check('role colour key order does not count as a change',
    !isDraftDirty({ ...fresh, roleColors: Object.fromEntries(Object.entries(fresh.roleColors).reverse()) }, saved));
check('blank number (NaN) is a change, not equal to null',
    isDraftDirty({ ...fresh, rules: fresh.rules.map((r, i) => i === 0 ? { ...r, paidBreaks: NaN } : r) }, saved));
check('adding a coverage rule is dirty', isDraftDirty({ ...fresh, coverageRules: [...fresh.coverageRules, { type: 'min_staff', roles: ['Any'], count: 1 }] }, saved));
check('colour change is dirty', isDraftDirty(draftSetRoleColor(fresh, 'Lead', '#000000'), saved));

console.log('\n— role operations —');
const added = draftAddRole(fresh, 'Supervisor');
check('add role', added.roleColors.Supervisor === '#94a3b8' && isDraftDirty(added, saved));
check('adding an existing role is a no-op', draftAddRole(fresh, 'Lead') === fresh);

const renamed = draftRenameRole(fresh, 'Manager', 'Store Manager');
check('rename moves the colour', renamed.roleColors['Store Manager'] === '#fbbf24' && !('Manager' in renamed.roleColors));
check('rename updates legacy coverage rule (role field)', renamed.coverageRules[1].role === 'Store Manager', JSON.stringify(renamed.coverageRules));
check('rename is recorded for Save', renamed.roleOps.length === 1 && renamed.roleOps[0].type === 'rename');
check('rename onto an existing role is refused', draftRenameRole(fresh, 'Manager', 'Lead') === fresh);
check('rename to the same name is a no-op', draftRenameRole(fresh, 'Lead', 'Lead') === fresh);

const multi = { ...fresh, coverageRules: [{ type: 'min_staff', roles: ['Lead', 'Manager'], operator: 'OR', count: 1 }] };
const multiDel = draftDeleteRole(multi, 'Lead');
check('delete removes role from a multi-role coverage rule', JSON.stringify(multiDel.coverageRules[0].roles) === '["Manager"]');
const onlyDel = draftDeleteRole({ ...fresh, coverageRules: [{ type: 'min_staff', roles: ['Lead'], count: 1 }] }, 'Lead');
check('deleting a rule\'s only role falls back to Any', JSON.stringify(onlyDel.coverageRules[0].roles) === '["Any"]');
check('delete removes the colour', !('Lead' in multiDel.roleColors));
check('deleting a role that does not exist is a no-op', draftDeleteRole(fresh, 'Nope') === fresh);

console.log('\n— applying role ops on Save —');
const ops = draftDeleteRole(draftRenameRole(draftRenameRole(fresh, 'Manager', 'Store Manager'), 'Store Manager', 'GM'), 'Lead').roleOps;
const emp = { id: 'a', name: 'Alex', roles: ['Manager'], default_role: 'Manager' };
const empOut = applyRoleOpsToEmployee(emp, ops);
check('chained renames apply in order (Manager → Store Manager → GM)', empOut.roles[0] === 'GM' && empOut.default_role === 'GM', JSON.stringify(empOut));
check('employee input is not mutated', emp.roles[0] === 'Manager');
const lead = applyRoleOpsToEmployee({ id: 'b', roles: ['Lead'], default_role: 'Lead' }, ops);
check('deleted role is removed from an employee', lead.roles.length === 0 && lead.default_role === null);
const rosterOut = applyRoleOpsToRosterItem({ id: 'r', name: 'Alex', defaultRole: 'Manager', default_role: 'Manager' }, ops);
check('roster member renamed', rosterOut.defaultRole === 'GM' && rosterOut.default_role === 'GM');
check('roster member keeps unrelated fields', rosterOut.name === 'Alex');

console.log('\n— validation —');
check('defaults are valid', validateDraft(fresh) === null);
check('blank break number is invalid', /Break rule 1/.test(validateDraft({ ...fresh, rules: fresh.rules.map((r, i) => i === 0 ? { ...r, minHours: NaN } : r) }) || ''));
check('negative break number is invalid', !!validateDraft({ ...fresh, rules: fresh.rules.map((r, i) => i === 1 ? { ...r, paidDuration: -5 } : r) }));
check('coverage count 0 is invalid', /Coverage rule 2/.test(validateDraft({ ...fresh, coverageRules: fresh.coverageRules.map((r, i) => i === 1 ? { ...r, count: 0 } : r) }) || ''));

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
