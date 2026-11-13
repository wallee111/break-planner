// ============================================================================
// Parameters draft
// ----------------------------------------------------------------------------
// Edits on the Parameters tab (break rules, coverage rules, roles) collect in
// a draft and only apply on Save. A draft is:
//   { rules, coverageRules, roleColors, roleOps }
// roleOps records role renames/deletes in order, so Save can apply the same
// changes to the day's team and the roster (which hold role names too).
// Coverage rules in the draft are updated immediately so the UI shows the
// renamed/removed roles while editing.
//
// Pure functions, no framework imports — testable in Node (test_parameters.mjs).
// ============================================================================

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Start a draft from the saved settings. */
export const createDraft = ({ rules, coverageRules, roleColors }) => ({
    rules: clone(rules || []),
    coverageRules: clone(coverageRules || []),
    roleColors: clone(roleColors || {}),
    roleOps: []
});

// Stable JSON for comparison: object keys sorted, NaN kept distinct from null.
const stable = (v) => JSON.stringify(v, (k, val) => {
    if (typeof val === 'number' && Number.isNaN(val)) return '__NaN__';
    if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {});
    }
    return val;
});

/**
 * True if the draft differs from what's saved. Changing a value and then
 * changing it back counts as clean, so the Save bar hides again.
 */
export const isDraftDirty = (draft, saved) => {
    if (!draft) return false;
    return stable(draft.rules) !== stable(saved.rules || [])
        || stable(draft.coverageRules) !== stable(saved.coverageRules || [])
        || stable(draft.roleColors) !== stable(saved.roleColors || {});
};

// --- Role operations on the draft -------------------------------------------

const renameInRule = (rule, from, to) => ({
    ...rule,
    ...(rule.role !== undefined ? { role: rule.role === from ? to : rule.role } : {}),
    ...(Array.isArray(rule.roles) ? { roles: rule.roles.map(r => r === from ? to : r) } : {})
});

const deleteFromRule = (rule, role) => {
    const next = { ...rule };
    if (rule.role !== undefined && rule.role === role) next.role = 'Any';
    if (Array.isArray(rule.roles)) {
        const roles = rule.roles.filter(r => r !== role);
        next.roles = roles.length ? roles : ['Any'];
    }
    return next;
};

export const draftAddRole = (draft, name, color = '#94a3b8') => {
    if (!name || draft.roleColors[name]) return draft;
    return { ...draft, roleColors: { ...draft.roleColors, [name]: color } };
};

export const draftSetRoleColor = (draft, role, color) => ({
    ...draft, roleColors: { ...draft.roleColors, [role]: color }
});

export const draftRenameRole = (draft, from, to) => {
    if (!from || !to || from === to || draft.roleColors[to] || !(from in draft.roleColors)) return draft;
    // Keep key order stable-ish: rebuild with the renamed key in place
    const roleColors = {};
    for (const [k, v] of Object.entries(draft.roleColors)) roleColors[k === from ? to : k] = v;
    return {
        ...draft,
        roleColors,
        coverageRules: draft.coverageRules.map(r => renameInRule(r, from, to)),
        roleOps: [...draft.roleOps, { type: 'rename', from, to }]
    };
};

export const draftDeleteRole = (draft, role) => {
    if (!(role in draft.roleColors)) return draft;
    const { [role]: _removed, ...roleColors } = draft.roleColors;
    return {
        ...draft,
        roleColors,
        coverageRules: draft.coverageRules.map(r => deleteFromRule(r, role)),
        roleOps: [...draft.roleOps, { type: 'delete', role }]
    };
};

// --- Applying role ops on Save ----------------------------------------------

/** Apply the draft's role renames/deletes to a day-team employee. */
export const applyRoleOpsToEmployee = (emp, roleOps) => roleOps.reduce((e, op) => {
    if (op.type === 'rename') {
        return {
            ...e,
            roles: (e.roles || []).map(r => r === op.from ? op.to : r),
            default_role: e.default_role === op.from ? op.to : e.default_role
        };
    }
    return {
        ...e,
        roles: (e.roles || []).filter(r => r !== op.role),
        default_role: e.default_role === op.role ? null : e.default_role
    };
}, emp);

/** Apply the draft's role renames/deletes to a roster member. */
export const applyRoleOpsToRosterItem = (item, roleOps) => roleOps.reduce((r, op) => {
    const swap = (v) => op.type === 'rename' ? (v === op.from ? op.to : v) : (v === op.role ? null : v);
    return {
        ...r,
        roles: r.roles
            ? (op.type === 'rename' ? r.roles.map(x => x === op.from ? op.to : x) : r.roles.filter(x => x !== op.role))
            : r.roles,
        defaultRole: swap(r.defaultRole),
        default_role: swap(r.default_role)
    };
}, item);

// --- Validation ---------------------------------------------------------------

const BREAK_FIELDS = ['minHours', 'maxHours', 'paidBreaks', 'unpaidBreaks', 'paidDuration', 'unpaidDuration'];

/**
 * Human-readable problem with the draft, or null if it can be saved.
 * Blank number fields arrive as NaN from the inputs.
 */
export const validateDraft = (draft) => {
    if (!draft) return null;
    const badBreak = draft.rules.findIndex(rule =>
        BREAK_FIELDS.some(f => rule[f] !== undefined && (typeof rule[f] !== 'number' || Number.isNaN(rule[f]) || rule[f] < 0)));
    if (badBreak >= 0) return `Break rule ${badBreak + 1} has an empty or negative number`;
    const badCoverage = draft.coverageRules.findIndex(r => typeof r.count !== 'number' || Number.isNaN(r.count) || r.count < 1);
    if (badCoverage >= 0) return `Coverage rule ${badCoverage + 1} needs a staff count of at least 1`;
    return null;
};
