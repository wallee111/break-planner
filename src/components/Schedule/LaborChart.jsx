import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { parse, setHours, setMinutes, format } from 'date-fns';

export const LaborChart = ({ employees, schedule, startHour, endHour, rules = [], roleColors = {} }) => {
    // Collect all unique roles present in employees for creating bars
    const allRoles = useMemo(() => {
        const roles = new Set();
        if (employees) {
            employees.forEach(e => {
                if (e.roles && e.roles.length > 0) roles.add(e.roles[0]);
                else if (e.default_role) roles.add(e.default_role);
                else roles.add('Staff');
            });
        }
        return Array.from(roles);
    }, [employees]);

    // Generate data points for every 15 minutes
    const { data, ticks, domain } = useMemo(() => {
        const chartData = [];
        const today = new Date();
        const start = setMinutes(setHours(today, startHour), 0);
        const startMs = start.getTime();
        const totalMinutes = (endHour - startHour) * 60;
        const endMs = startMs + totalMinutes * 60000;

        const tickValues = [];
        for (let t = startMs; t <= endMs; t += 3600000) { // Hourly ticks
            tickValues.push(t);
        }

        for (let m = 0; m < totalMinutes; m += 15) {
            const currentPoint = new Date(startMs + m * 60000);
            const ts = currentPoint.getTime();
            const displayTimeStr = format(currentPoint, 'HH:mm');

            // Initialize counts for this time slot
            const pointData = {
                timestamp: ts,
                time: displayTimeStr,
                label: displayTimeStr,
                total: 0,
                onBreak: 0
            };
            allRoles.forEach(r => pointData[r] = 0);

            employees.forEach(emp => {
                const empSchedule = schedule.find(s => s.employeeId === emp.id);
                if (!empSchedule || !emp.startTime || !emp.endTime) return;

                const shiftStart = parse(emp.startTime, 'HH:mm', today);
                let shiftEnd = parse(emp.endTime, 'HH:mm', today);

                // Handle overnight
                if (shiftEnd < shiftStart) {
                    shiftEnd = setMinutes(setHours(shiftStart, 0), 0);
                    shiftEnd.setDate(shiftEnd.getDate() + 1);
                    const parsedEnd = parse(emp.endTime, 'HH:mm', shiftEnd);
                    shiftEnd = parsedEnd;
                }

                if (currentPoint >= shiftStart && currentPoint < shiftEnd) {
                    let onBreak = false;
                    if (empSchedule.breaks) {
                        for (const brk of empSchedule.breaks) {
                            // Ensure break times are parsed relative to the current day for comparison
                            const getStr = (d) => d instanceof Date ? format(d, 'HH:mm') : d;
                            const rangeStartStr = getStr(brk.startTime);
                            const rangeEndStr = getStr(brk.endTime);

                            const breakStart = parse(rangeStartStr, 'HH:mm', currentPoint);
                            let breakEnd = parse(rangeEndStr, 'HH:mm', currentPoint);

                            if (breakEnd < breakStart) { // Handle overnight breaks
                                breakEnd = setMinutes(setHours(breakStart, 0), 0);
                                breakEnd.setDate(breakEnd.getDate() + 1);
                                const parsedBreakEnd = parse(rangeEndStr, 'HH:mm', breakEnd);
                                breakEnd = parsedBreakEnd;
                            }

                            if (currentPoint >= breakStart && currentPoint < breakEnd) {
                                onBreak = true;
                                break;
                            }
                        }
                    }

                    if (onBreak) {
                        pointData.onBreak++;
                    } else {
                        const role = (emp.roles && emp.roles[0]) || emp.default_role || 'Staff';
                        pointData[role] = (pointData[role] || 0) + 1;
                        pointData.total++;
                    }
                }
            });

            chartData.push(pointData);

            // Add GAP Point (14 mins later, 0 value)
            const gapData = {
                timestamp: ts + 14 * 60000, // 14 mins into the slot
                time: displayTimeStr,
                label: '',
                total: 0,
                onBreak: 0
            };
            allRoles.forEach(r => gapData[r] = 0);
            chartData.push(gapData);
        }

        // Add final closing point if needed? 
        // stepAfter draws until next point.
        // If last point corresponds to [End - 15m], it draws until End-1m (Gap start).
        // Then Gap draws from End-1m to ...?
        // We need an explicit end point at `endMs` to close the chart?
        // Recharts domain handles layout width.
        // If data ends at End-1m (start of last gap), it draws flat to right.
        // It should suffice.

        return { data: chartData, ticks: tickValues, domain: [startMs, endMs] };
    }, [employees, schedule, startHour, endHour, allRoles]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            // Don't show tooltip for gaps (total 0 and effectively 0 duration in perception)
            if (data.total === 0 && data.onBreak === 0) return null;

            return (
                <div className="bg-slate-800 text-white text-xs rounded-md shadow-xl p-3 border border-slate-700 min-w-[120px] z-50">
                    <div className="font-bold mb-2 text-center border-b border-slate-600 pb-1">{data.time}</div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 opacity-90">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                <span>Active</span>
                            </div>
                            <span className="font-mono font-medium">{data.total}</span>
                        </div>
                        {data.onBreak > 0 && (
                            <div className="flex justify-between items-center text-amber-200/90">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                    <span>On Break</span>
                                </div>
                                <span className="font-mono font-medium">{data.onBreak}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!employees || employees.length === 0) return null;

    // Filter relevant rules
    const minStaffRules = rules.filter(r => r.type === 'min_staff');

    return (
        <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#e2e8f0" horizontal={true} />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={domain}
                        ticks={ticks}
                        tickFormatter={(t) => format(t, 'HH:mm')}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 0, right: 0 }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        allowDecimals={false}
                        orientation="right"
                        width={20}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />

                    {/* Render a Stacked Area for each Role */}
                    {allRoles.map((role) => (
                        <Area
                            key={role}
                            type="stepAfter"
                            dataKey={role}
                            stackId="1"
                            stroke="none"
                            fill={roleColors[role] || '#6366f1'}
                            fillOpacity={0.6}
                        />
                    ))}

                    {/* On Break Area */}
                    <Area
                        type="stepAfter"
                        dataKey="onBreak"
                        stackId="1"
                        stroke="none"
                        fill="#94a3b8"
                        fillOpacity={0.5}
                    />

                    {/* Reference Lines for Min Staff rules */}
                    {minStaffRules.map((rule, idx) => (
                        <ReferenceLine
                            key={idx}
                            y={rule.count}
                            stroke="#ef4444"
                            strokeDasharray="3 3"
                            ifOverflow="extendDomain"
                            label={{
                                value: `Min: ${rule.count} (${rule.role})`,
                                position: 'insideTopRight',
                                fill: '#ef4444',
                                fontSize: 10,
                                dy: -10
                            }}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
