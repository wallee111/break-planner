import React, { useState, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Clock } from 'lucide-react';

export const StoreHoursConfig = () => {
    const { storeHours, updateStoreHours } = usePlanner();

    const handleChange = (dayIndex, field, value) => {
        const newHours = [...storeHours];
        newHours[dayIndex] = { ...newHours[dayIndex], [field]: value };
        updateStoreHours(newHours);
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const { viewRange, updateViewRange } = usePlanner();

    // Local state
    const [localRange, setLocalRange] = useState(viewRange);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        // Sync local state when global state changes (e.g. initial load or external update)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalRange(prev => {
            if (prev.start === viewRange.start && prev.end === viewRange.end) return prev;
            return viewRange;
        });
        setHasChanges(false);
    }, [viewRange]);

    const handleRangeChange = (field, value) => {
        const val = parseInt(value);
        if (isNaN(val)) return;

        setLocalRange(prev => ({ ...prev, [field]: val }));
        setHasChanges(true);
    };

    const handleSaveRange = () => {
        if (localRange.start >= localRange.end) {
            alert('Start time must be before end time');
            return;
        }
        updateViewRange(localRange);
        setHasChanges(false);
    };

    return (
        <Card title="Store Hours" icon={<Clock className="w-5 h-5 text-indigo-600" />}>
            <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3">Day</th>
                            <th className="px-4 py-3 text-center">Open?</th>
                            <th className="px-4 py-3">Open Time</th>
                            <th className="px-4 py-3">Close Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {storeHours.map((day, index) => (
                            <tr key={days[index]} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-700">{days[index]}</td>
                                <td className="px-4 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={day.isOpen}
                                        onChange={(e) => handleChange(index, 'isOpen', e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <Input
                                        type="time"
                                        disabled={!day.isOpen}
                                        value={day.openTime}
                                        onChange={(e) => handleChange(index, 'openTime', e.target.value)}
                                        className={`w-32 ${!day.isOpen ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <Input
                                        type="time"
                                        disabled={!day.isOpen}
                                        value={day.closeTime}
                                        onChange={(e) => handleChange(index, 'closeTime', e.target.value)}
                                        className={`w-32 ${!day.isOpen ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-slate-100 pt-6">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">Timeline Range</h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Sets the visible hours on the main schedule timeline.
                        </p>
                    </div>
                    {hasChanges && (
                        <button
                            onClick={handleSaveRange}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors font-medium animate-in fade-in"
                        >
                            Save Range
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Start Hour (0-23)</label>
                        <Input
                            type="number"
                            min="0"
                            max="23"
                            value={localRange.start}
                            onChange={(e) => handleRangeChange('start', e.target.value)}
                            className="w-24"
                        />
                    </div>
                    <div className="text-slate-400">-</div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">End Hour (1-24)</label>
                        <Input
                            type="number"
                            min="1"
                            max="24"
                            value={localRange.end}
                            onChange={(e) => handleRangeChange('end', e.target.value)}
                            className="w-24"
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
};
