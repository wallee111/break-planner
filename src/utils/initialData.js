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
    { minHours: 0, maxHours: 5, paidBreaks: 1, unpaidBreaks: 0, paidDuration: 15, unpaidDuration: 0 },
    { minHours: 5, maxHours: 7, paidBreaks: 1, unpaidBreaks: 1, paidDuration: 15, unpaidDuration: 30 },
    { minHours: 7, maxHours: 24, paidBreaks: 2, unpaidBreaks: 1, paidDuration: 15, unpaidDuration: 30 },
];

export const INITIAL_COVERAGE_RULES = [
    { type: 'min_staff', role: 'Any', count: 2 },
    { type: 'min_staff', role: 'Manager', count: 1 },
];

export const INITIAL_ROLE_COLORS = {
    'Product Guide': '#34d399', // emerald-400
    'Lead': '#818cf8',         // indigo-400
    'Manager': '#fbbf24',      // amber-400
    'Associate': '#94a3b8'     // slate-400
};

export const INITIAL_STORE_HOURS = [
    { day: 'Monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'Tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'Wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'Thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'Friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'Saturday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
    { day: 'Sunday', isOpen: false, openTime: '10:00', closeTime: '18:00' }
];
