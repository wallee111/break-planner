/**
 * @typedef {Object} Employee
 * @property {string} id
 * @property {string} name
 * @property {string[]} roles
 * @property {string} startTime - HH:MM
 * @property {string} endTime - HH:MM
 */

/**
 * @typedef {Object} BreakRule
 * @property {number} minHours
 * @property {number} maxHours
 * @property {BreakDefinition[]} breaks
 */

/**
 * @typedef {Object} BreakDefinition
 * @property {number} duration - minutes
 * @property {string} type - 'paid' | 'meal'
 */

/**
 * @typedef {Object} Schedule
 * @property {string} employeeId
 * @property {BreakBlock[]} breaks
 */

/**
 * @typedef {Object} BreakBlock
 * @property {string} id
 * @property {string} type
 * @property {number} duration
 * @property {Date} startTime
 * @property {Date} endTime
 */

export const INITIAL_EMPLOYEES = [
    { id: '1', name: 'Alex', roles: ['Manager'], startTime: '09:00', endTime: '17:00' },
    { id: '2', name: 'Sam', roles: ['Lead'], startTime: '10:00', endTime: '18:00' },
    { id: '3', name: 'Taylor', roles: ['Product Guide'], startTime: '09:00', endTime: '14:00' },
];

export const INITIAL_RULES = [
    { minHours: 0, maxHours: 5, breaks: [{ duration: 15, type: 'paid' }] },
    { minHours: 5, maxHours: 7, breaks: [{ duration: 15, type: 'paid' }, { duration: 30, type: 'meal' }] },
    { minHours: 7, maxHours: 24, breaks: [{ duration: 15, type: 'paid' }, { duration: 30, type: 'meal' }, { duration: 15, type: 'paid' }] },
];

export const INITIAL_COVERAGE_RULES = [
    { type: 'min_staff', role: 'Any', count: 2 },
    { type: 'min_staff', role: 'Manager', count: 1 },
];

export const INITIAL_ROLE_COLORS = {
    'Manager': '#f87171', // Red-400
    'Lead': '#fbbf24', // Amber-400
    'Product Guide': '#34d399', // Emerald-400
    'Associate': '#60a5fa', // Blue-400
};
