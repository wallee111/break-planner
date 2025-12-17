
import { generateSchedule } from './src/utils/scheduler.js';
import { addMinutes, format } from 'date-fns';

console.log("Testing for Break Clumping...");

// 1 Employee, Long Shift (needs multiple breaks)
const employees = [
    { id: '1', name: 'Test User', roles: ['Product Guide'], startTime: '09:00', endTime: '18:00' } // 9 hours
];

// Rule: 9 hours -> 2 Paid (15m) + 1 Meal (30m) = 3 breaks
const rules = [
    {
        minHours: 8, maxHours: 24,
        paidBreaks: 2, unpaidBreaks: 1,
        paidDuration: 15, unpaidDuration: 30
    }
];

const schedule = generateSchedule(employees, rules);
const breaks = schedule[0].breaks;

console.log("Breaks Scheduled:");
breaks.forEach((b, i) => {
    console.log(`${i + 1}. ${b.type} (${b.duration}m): ${format(b.startTime, 'HH:mm')} - ${format(b.endTime, 'HH:mm')}`);
});

// Check gaps
for (let i = 0; i < breaks.length - 1; i++) {
    const end = breaks[i].endTime;
    const start = breaks[i + 1].startTime;
    const gap = (start - end) / 60000;
    console.log(`Gap between break ${i + 1} and ${i + 2}: ${gap} minutes`);
}
