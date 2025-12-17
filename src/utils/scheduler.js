import { addMinutes, differenceInMinutes, parse, format, addHours, isWithinInterval, roundToNearestMinutes } from 'date-fns';

const roundToNearest15 = (date) => roundToNearestMinutes(date, { nearestTo: 15, roundingMethod: 'round' });

/**
 * Generates a schedule for employees based on rules.
 */
// Priority: Product Guide (3) > Lead (2) > Manager (1) > Associate (0)
const ROLE_PRIORITY = {
    'Product Guide': 3,
    'Lead': 2,
    'Manager': 1,
    'Associate': 0
};

const getPriority = (roles) => {
    if (!roles || roles.length === 0) return 0;
    // Use highest priority role
    return Math.max(...roles.map(r => ROLE_PRIORITY[r] || 0));
};

// Helper to find applicable rule with robustness for gaps
const findRule = (rules, durationHours) => {
    // 1. Strict Match
    let rule = rules.find(r => durationHours >= r.minHours && durationHours < r.maxHours);
    if (rule) return rule;

    // 2. Tolerance Match (handle float precision or tiny gaps)
    // Check if we are "close enough" to a rule's range
    rule = rules.find(r => durationHours >= (r.minHours - 0.1) && durationHours < (r.maxHours + 0.1));
    if (rule) return rule;

    // 3. Fallback for "Exact Boundary" issues (e.g. duration 8, rule 0-8)
    // If we are exactly at maxHours, and no "next rule" caught us, maybe we belong to the previous one?
    // Or if we are below minHours of the first rule?

    return null;
};

export const calculateBreaks = (startTimeStr, endTimeStr, rules) => {
    const start = parse(startTimeStr, 'HH:mm', new Date());
    let end = parse(endTimeStr, 'HH:mm', new Date());

    // Handle overnight
    if (end < start) {
        end = addMinutes(end, 24 * 60);
    }

    const totalMinutes = differenceInMinutes(end, start);
    const durationHours = totalMinutes / 60;

    // Find applicable rule
    const rule = findRule(rules, durationHours);
    if (!rule) return [];

    let breaks = [];

    const count = rule.paidBreaks + rule.unpaidBreaks;
    if (count === 0) return [];

    const segment = totalMinutes / (count + 1);

    let breakIndex = 0;

    // Add Paid Breaks
    for (let i = 0; i < rule.paidBreaks; i++) {
        breakIndex++;
        let breakStart = addMinutes(start, Math.round(segment * breakIndex));
        breakStart = roundToNearest15(breakStart);
        breaks.push({
            id: crypto.randomUUID(),
            startTime: breakStart,
            endTime: addMinutes(breakStart, rule.paidDuration),
            duration: rule.paidDuration,
            type: 'paid'
        });
    }

    // Add Unpaid Breaks
    for (let i = 0; i < rule.unpaidBreaks; i++) {
        breakIndex++;
        let breakStart = addMinutes(start, Math.round(segment * breakIndex));
        breakStart = roundToNearest15(breakStart);
        breaks.push({
            id: crypto.randomUUID(),
            startTime: breakStart,
            endTime: addMinutes(breakStart, rule.unpaidDuration),
            duration: rule.unpaidDuration,
            type: 'unpaid'
        });
    }

    // Sort by time
    breaks.sort((a, b) => a.startTime - b.startTime);

    return breaks;
};

// --- Smart Scheduling Logic ---

// Helper to generate all 15-minute slots in a range
const generateSlots = (start, end) => {
    const slots = [];
    let current = start;
    while (current < end) {
        slots.push(current);
        current = addMinutes(current, 15);
    }
    return slots;
};

// Helper to get a time key for the map (e.g. "09:00")
const getTimeKey = (date) => format(date, 'HH:mm');

// Helper to get time range for shift
const getShiftRange = (emp) => {
    const start = parse(emp.startTime, 'HH:mm', new Date());
    let end = parse(emp.endTime, 'HH:mm', new Date());
    if (end < start) end = addMinutes(end, 24 * 60);
    return { start, end };
};

/**
 * CoverageMap: Tracks how many people are working in each 15m slot, per Role.
 */
class CoverageMap {
    constructor() {
        this.totalMap = new Map(); // TimeKey -> TotalCount
        this.roleMap = new Map(); // TimeKey -> Map<Role, Count>
    }

    increment(start, end, roles = []) {
        const slots = generateSlots(start, end);
        slots.forEach(slot => {
            const key = getTimeKey(slot);

            // Update Total
            this.totalMap.set(key, (this.totalMap.get(key) || 0) + 1);

            // Update Roles
            if (!this.roleMap.has(key)) {
                this.roleMap.set(key, new Map());
            }
            const timeRoles = this.roleMap.get(key);
            roles.forEach(role => {
                timeRoles.set(role, (timeRoles.get(role) || 0) + 1);
            });
        });
    }

    decrement(start, end, roles = []) {
        const slots = generateSlots(start, end);
        slots.forEach(slot => {
            const key = getTimeKey(slot);

            // Update Total
            const newTotal = (this.totalMap.get(key) || 0) - 1;
            this.totalMap.set(key, newTotal);

            // Update Roles
            if (this.roleMap.has(key)) {
                const timeRoles = this.roleMap.get(key);
                roles.forEach(role => {
                    timeRoles.set(role, (timeRoles.get(role) || 0) - 1);
                });
            }
        });
    }

    getMinCoverage(start, end, role = 'Any') {
        const slots = generateSlots(start, end);
        let min = Infinity;
        slots.forEach(slot => {
            const key = getTimeKey(slot);
            let count = 0;
            if (role === 'Any') {
                count = this.totalMap.get(key) || 0;
            } else {
                const timeRoles = this.roleMap.get(key);
                count = timeRoles ? (timeRoles.get(role) || 0) : 0;
            }
            if (count < min) min = count;
        });
        return min === Infinity ? 0 : min;
    }
}

/**
 * Finds the best start time for a break within a valid window.
 * Strategy: Maximize minimum coverage during the break.
 */
const findBestBreakStart = (windowStart, windowEnd, durationMinutes, coverageMap, idealMidPoint, existingBreaks = [], minGap = 60, coverageRules = [], employeeRoles = []) => {
    let bestStart = null;
    let maxMinCoverage = -Infinity; // Now represents a "Score"
    let minDistanceFromIdeal = Infinity;

    // Iterate through potential start times in 15m increments
    let current = roundToNearestMinutes(windowStart, { nearestTo: 15 });
    if (current < windowStart) current = addMinutes(current, 15);
    const lastPossibleStart = addMinutes(windowEnd, -durationMinutes);

    while (current <= lastPossibleStart) {
        const breakEnd = addMinutes(current, durationMinutes);

        // 1. GAP CHECK
        const isTooClose = existingBreaks.some(b => {
            // Basic Overlap/Gap logic
            if (current >= b.endTime) return differenceInMinutes(current, b.endTime) < minGap;
            if (breakEnd <= b.startTime) return differenceInMinutes(b.startTime, breakEnd) < minGap;
            return true; // Overlap
        });

        if (isTooClose) {
            current = addMinutes(current, 15);
            continue;
        }

        // 2. COVERAGE SCORE CALCULATION
        // We want to maximize the 'Surplus' and AVOID violations.

        let ruleViolationScore = 0; // Negative for violations
        let surplusScore = 0;       // Positive for extra heads

        // Temporarily 'take' the break to see effect
        // (We don't modify map, we query it)
        // logic: if getMinCoverage during break < MinRequired, it's a violation.

        // Check Global Total Rule (Role='Any') explicitly if needed, or via rules list
        // Check Specific Role Rules

        // Optimization: We check coverage for this specific interval
        // getMinCoverage returns the LOWEST count during the break window `[current, breakEnd)`

        // Check each rule
        coverageRules.forEach(rule => {
            // Does this rule apply to ME? 
            // If rule is for 'Manager', and I am NOT a manager, my break doesn't reduce Manager count (unless I am).
            // Wait, if I am Not a Manager, my break reduces 'Any' count, but not 'Manager' count.
            // So we only care if: role === 'Any' OR employeeRoles.includes(rule.role).

            const isRelevant = rule.role === 'Any' || employeeRoles.includes(rule.role);
            if (!isRelevant) return;

            const currentMin = coverageMap.getMinCoverage(current, breakEnd, rule.role);
            // Since I AM working right now (assumed), taking a break reduces count by 1.
            // But wait, CoverageMap currently holds values Assuming I am working.
            // So 'Actual Count During Break' = currentMin - 1.

            const projectedCount = currentMin - 1;

            if (projectedCount < rule.count) {
                // VIOLATION!
                // Heavy penalty.
                ruleViolationScore -= 1000;
                // Maybe weigh by magnitude of failure? 
                ruleViolationScore -= (rule.count - projectedCount) * 100;
            } else {
                // No violation. Add to surplus.
                // Prefer times with MORE people.
                surplusScore += (projectedCount - rule.count);
            }
        });

        // 3. Fallback logic: If no rules exist, just default to total coverage
        if (coverageRules.length === 0) {
            surplusScore = coverageMap.getMinCoverage(current, breakEnd, 'Any');
        }

        const totalScore = ruleViolationScore + surplusScore;
        const dist = Math.abs(differenceInMinutes(current, idealMidPoint));

        if (totalScore > maxMinCoverage) {
            maxMinCoverage = totalScore;
            minDistanceFromIdeal = dist;
            bestStart = current;
        } else if (totalScore === maxMinCoverage) {
            // Tie-breaker
            if (dist < minDistanceFromIdeal) {
                minDistanceFromIdeal = dist;
                bestStart = current;
            }
        }

        current = addMinutes(current, 15);
    }

    return bestStart || windowStart;
};


export const generateSchedule = (employees, rules, coverageRules = []) => {
    // 1. Initialize Coverage Map with everyone present (Base State)
    const coverageMap = new CoverageMap();

    // Sort employees by priority (Manager/Key roles first? Or maybe tightest constraints first?)
    // Actually, sorting by LENGTH of shift descending might be better to place big blocks first.
    // For now, let's stick to Start Time to be intuitive.
    const sortedEmployees = [...employees].sort((a, b) => {
        const tA = parse(a.startTime, 'HH:mm', new Date()).getTime();
        const tB = parse(b.startTime, 'HH:mm', new Date()).getTime();
        if (tA !== tB) return tA - tB;
        return getPriority(b.roles) - getPriority(a.roles); // Higher priority first
    });

    // Populate initial coverage
    sortedEmployees.forEach(emp => {
        const { start, end } = getShiftRange(emp);
        coverageMap.increment(start, end, emp.roles);
    });

    return sortedEmployees.map(emp => {
        const { start, end } = getShiftRange(emp);
        const shiftDurationHours = differenceInMinutes(end, start) / 60;

        // Find Rule
        const rule = findRule(rules, shiftDurationHours);
        if (!rule) {
            return {
                employeeId: emp.id,
                employeeName: emp.name,
                breaks: []
            };
        }

        const myBreaks = [];
        const shiftMidPoint = addMinutes(start, differenceInMinutes(end, start) / 2);

        // Gather all breaks needed
        const breaksToSchedule = [];
        for (let i = 0; i < rule.unpaidBreaks; i++) breaksToSchedule.push({ type: 'meal', duration: rule.unpaidDuration });
        for (let i = 0; i < rule.paidBreaks; i++) breaksToSchedule.push({ type: 'paid', duration: rule.paidDuration });

        if (breaksToSchedule.length === 0) {
            return { employeeId: emp.id, employeeName: emp.name, breaks: [] };
        }

        // Generate Zones (Dynamic Relative Anchors)
        const totalBreaks = breaksToSchedule.length;
        const totalDuration = differenceInMinutes(end, start);
        const anchors = [];
        for (let i = 1; i <= totalBreaks; i++) {
            anchors.push(addMinutes(start, totalDuration * (i / (totalBreaks + 1))));
        }

        // Sort breaks: Meals first (largest duration)
        breaksToSchedule.sort((a, b) => b.duration - a.duration);

        // Schedule each break
        breaksToSchedule.forEach(brk => {
            // Find best anchor
            let bestAnchorIdx = -1;

            if (brk.type === 'meal') {
                // For Meal: Find available anchor closest to local Shift Midpoint
                let minD = Infinity;
                anchors.forEach((anc, idx) => {
                    if (anc === null) return; // Taken
                    const d = Math.abs(differenceInMinutes(anc, shiftMidPoint));
                    if (d < minD) { minD = d; bestAnchorIdx = idx; }
                });
            } else {
                // For Rests: Chronological fill of remaining anchors
                bestAnchorIdx = anchors.findIndex(a => a !== null);
            }

            const targetAnchor = (bestAnchorIdx !== -1) ? anchors[bestAnchorIdx] : shiftMidPoint;
            if (bestAnchorIdx !== -1) anchors[bestAnchorIdx] = null;

            // DEFINE DYNAMIC ZONE WINDOW
            // Zone Radius: 15% of Shift Duration
            // E.g. 8h shift -> 1.2h radius -> 2.4h window around anchor.
            const zoneRadius = totalDuration * 0.15;

            let windowStart = addMinutes(targetAnchor, -zoneRadius);
            let windowEnd = addMinutes(targetAnchor, zoneRadius);

            // Hard Clamps
            const hardStart = addMinutes(start, 30); // Start + 30m
            const hardEnd = addMinutes(end, -30); // End - 30m

            if (windowStart < hardStart) windowStart = hardStart;
            if (windowEnd > hardEnd) windowEnd = hardEnd;

            // If window collapsed, fallback to wider range
            if (windowStart >= windowEnd) {
                windowStart = hardStart;
                windowEnd = hardEnd;
            }

            // Find Best Slot constrained to Zone
            const MIN_GAP_MINUTES = 60;
            const bestStart = findBestBreakStart(windowStart, windowEnd, brk.duration, coverageMap, targetAnchor, myBreaks, MIN_GAP_MINUTES, coverageRules, emp.roles);
            const bestEnd = addMinutes(bestStart, brk.duration);

            // "Book" the break
            coverageMap.decrement(bestStart, bestEnd, emp.roles);

            myBreaks.push({
                id: crypto.randomUUID(),
                startTime: bestStart,
                endTime: bestEnd,
                duration: brk.duration,
                type: brk.type
            });
        });

        // Ensure chronological order for final output
        myBreaks.sort((a, b) => a.startTime - b.startTime);

        return {
            employeeId: emp.id,
            employeeName: emp.name,
            breaks: myBreaks
        };
    });
};

// Helper to check if a time is within a break
const isOnBreak = (time, breaks) => {
    return breaks.some(b => isWithinInterval(time, { start: b.startTime, end: addMinutes(b.endTime, -1) })); // -1 to avoid overlap on exact boundary
};

export const validateSchedule = (schedule, employees, coverageRules, storeHours) => {
    const warnings = [];

    if (!schedule || schedule.length === 0) return warnings;

    // 1. Determine timeline range
    let minStart = new Date(8640000000000000);
    let maxEnd = new Date(-8640000000000000);

    const empMap = new Map(employees.map(e => [e.id, e]));

    employees.forEach(emp => {
        const start = parse(emp.startTime, 'HH:mm', new Date());
        const end = parse(emp.endTime, 'HH:mm', new Date());
        if (start < minStart) minStart = start;
        if (end > maxEnd) maxEnd = end;
    });

    if (minStart > maxEnd) return warnings;

    // 2. Iterate through timeline in 15 minute increments
    let currentTime = minStart;
    while (currentTime < maxEnd) {
        // Calculate active staff
        const activeStaff = {
            total: 0,
            byRole: {}
        };

        schedule.forEach(schedItem => {
            const emp = empMap.get(schedItem.employeeId);
            if (!emp) return;

            // Check if emp is working at this time (within shift)
            const shiftStart = parse(emp.startTime, 'HH:mm', new Date());
            const shiftEnd = parse(emp.endTime, 'HH:mm', new Date());

            if (currentTime >= shiftStart && currentTime < shiftEnd) {
                // Check if on break
                if (!isOnBreak(currentTime, schedItem.breaks)) {
                    activeStaff.total++;
                    emp.roles.forEach(role => {
                        activeStaff.byRole[role] = (activeStaff.byRole[role] || 0) + 1;
                    });
                }
            }
        });

        // 3. Check rules
        coverageRules.forEach(rule => {
            // New: Check Store Hours for this day
            // Assumption: Validation runs on "Current" day or generic. 
            // Since we don't have a specific date passed in except maybe minStart, 
            // let's assume validSchedule is for "Today" or we check the day of the week of `currentTime`.

            const currentDayIndex = currentTime.getDay(); // 0 = Sun
            // Map 0 (Sun) -> 6, 1 (Mon) -> 0... wait. 
            // days array in config: Mon, Tue... Sat, Sun.
            // Mon=0, Tue=1... Sun=6.
            // Date.getDay(): Sun=0, Mon=1...
            // Mapper: (day + 6) % 7.
            const configDayIndex = (currentDayIndex + 6) % 7;

            let isStoreOpen = true;
            if (storeHours) {
                const dayConfig = storeHours[configDayIndex];
                if (dayConfig && !dayConfig.isOpen) {
                    isStoreOpen = false;
                } else if (dayConfig) {
                    // Check time range
                    const timeStr = format(currentTime, 'HH:mm');
                    if (timeStr < dayConfig.openTime || timeStr >= dayConfig.closeTime) {
                        isStoreOpen = false;
                    }
                }
            }

            if (isStoreOpen && rule.type === 'min_staff') {
                let currentCount = 0;
                if (rule.role === 'Any') {
                    currentCount = activeStaff.total;
                } else {
                    currentCount = activeStaff.byRole[rule.role] || 0;
                }

                if (currentCount < rule.count) {
                    // Deduplicate warnings slightly by only adding if unique time/rule combo or simplify
                    // For now, just add a generic warning for the time block
                    const timeStr = format(currentTime, 'HH:mm');
                    warnings.push({
                        time: timeStr,
                        message: `Low coverage for ${rule.role}: Found ${currentCount}, needed ${rule.count}`
                    });
                }
            }
        });

        currentTime = addMinutes(currentTime, 15);
    }

    // Deduplicate and group warnings
    // (Group consecutive times) - basic grouping

    return warnings;
};
