import React from 'react';
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

    return (
        <Card title="Store Hours" icon={<Clock className="w-5 h-5 text-indigo-600" />}>
            <div className="overflow-x-auto">
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
        </Card>
    );
};
