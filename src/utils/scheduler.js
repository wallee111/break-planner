import { addMinutes, differenceInMinutes, parse, format, addHours, isWithinInterval } from 'date-fns';

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

export const generateSchedule = (employees, rules) => {
    // 1. Sort employees by Start Time (Earliest first), then Priority
    const sortedEmployees = [...employees].sort((a, b) => {
        // Parse times to comparable values
        const tA = parse(a.startTime, 'HH:mm', new Date()).getTime();
        const tB = parse(b.startTime, 'HH:mm', new Date()).getTime();

        if (tA !== tB) return tA - tB;

        // Secondary sort: Priority
        const pA = getPriority(a.roles);
        const pB = getPriority(b.roles);
        if (pA !== pB) return pB - pA;

        return a.id.localeCompare(b.id);
    });

    // 2. Initialize Global Load Map (15m slots)
    // Map<TimeStamp, Count>
    const globalLoad = new Map();

    const addToLoad = (start, end) => {
        let curr = start;
        while (curr < end) {
            const timeKey = curr.getTime();
            globalLoad.set(timeKey, (globalLoad.get(timeKey) || 0) + 1);
            curr = addMinutes(curr, 15);
        }
    };

    const getLoad = (start, durationMins) => {
        let maxLoad = 0;
        let curr = start;
        const end = addMinutes(start, durationMins);
        while (curr < end) {
            const load = globalLoad.get(curr.getTime()) || 0;
            if (load > maxLoad) maxLoad = load;
            curr = addMinutes(curr, 15);
        }
        return maxLoad;
    };

    const schedule = [];

    // 3. Sequential Scheduling
    sortedEmployees.forEach(emp => {
        const start = parse(emp.startTime, 'HH:mm', new Date());
        const end = parse(emp.endTime, 'HH:mm', new Date());
        let durationHours = differenceInMinutes(end, start) / 60;
        if (durationHours < 0) durationHours += 24;

        // Find rule
        const rule = rules.find(r => durationHours > r.minHours && durationHours <= r.maxHours);

        if (!rule) {
            schedule.push({ employeeId: emp.id, breaks: [] });
            return;
        }

        const myBreaks = [];

        // Define safe zone (Start + 1h to End - 1h)
        let safeStart = addHours(start, 1);
        let safeEnd = addHours(end, -1);
        if (safeStart >= safeEnd) {
            safeStart = start;
            safeEnd = end;
        }

        const availableMinutes = differenceInMinutes(safeEnd, safeStart);

        // Sort breaks to schedule: Meals first
        const breaksToSchedule = [...rule.breaks].sort((a, b) => {
            if (a.type === 'meal') return -1;
            if (b.type === 'meal') return 1;
            return b.duration - a.duration;
        });

        // Ideal placement strategy:
        // Divide shift into equal segments based on # of breaks.
        // Try to place break at segment center.
        // If high load, spiral out ±15m until better slot found.

        const segmentSize = availableMinutes / (breaksToSchedule.length + 1);

        breaksToSchedule.forEach((b, idx) => {
            const idealOffset = segmentSize * (idx + 1);
            const idealStart = addMinutes(safeStart, idealOffset - (b.duration / 2));

            // Snap to 15m
            const minutes = idealStart.getMinutes();
            const remainder = minutes % 15;
            let snappedStart = addMinutes(idealStart, -remainder);
            if (remainder > 7) snappedStart = addMinutes(snappedStart, 15);

            // Optimization Scan
            // Search radius: +/- 90 mins
            let bestStart = snappedStart;
            let lowestLoad = Infinity;

            // Search heuristic: Check ideal, then +15, -15, +30, -30...
            for (let i = 0; i <= 6; i++) { // Check up to 6 slots away (90 mins total spread)
                const candidates = [];
                if (i === 0) candidates.push(snappedStart);
                else {
                    candidates.push(addMinutes(snappedStart, i * 15));
                    candidates.push(addMinutes(snappedStart, -i * 15));
                }

                for (const candidate of candidates) {
                    // Check bounds
                    if (candidate < safeStart || addMinutes(candidate, b.duration) > safeEnd) continue;

                    // Check overlap with my own existing breaks
                    const overlapsOwn = myBreaks.some(existing => {
                        const existingEnd = addMinutes(existing.startTime, existing.duration);
                        const candEnd = addMinutes(candidate, b.duration);
                        return candidate < existingEnd && candEnd > existing.startTime;
                    });

                    if (overlapsOwn) continue;

                    const load = getLoad(candidate, b.duration);
                    if (load < lowestLoad) {
                        lowestLoad = load;
                        bestStart = candidate;
                    }
                }

                // If we found a 0 load slot, take it immediately!
                if (lowestLoad === 0) break;
            }

            // Commit break
            const finalBreak = {
                id: crypto.randomUUID(),
                type: b.type,
                duration: b.duration,
                startTime: bestStart,
                endTime: addMinutes(bestStart, b.duration)
            };

            myBreaks.push(finalBreak);
            addToLoad(finalBreak.startTime, finalBreak.endTime);
        });

        myBreaks.sort((a, b) => a.startTime - b.startTime);
        schedule.push({ employeeId: emp.id, breaks: myBreaks });
    });

    return schedule;
};

// Helper to check if a time is within a break
const isOnBreak = (time, breaks) => {
    return breaks.some(b => isWithinInterval(time, { start: b.startTime, end: addMinutes(b.endTime, -1) })); // -1 to avoid overlap on exact boundary
};

export const validateSchedule = (schedule, employees, coverageRules) => {
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
            if (rule.type === 'min_staff') {
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
