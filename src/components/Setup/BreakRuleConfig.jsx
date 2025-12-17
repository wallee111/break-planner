import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trash2, Plus, Clock, Coffee, DollarSign } from 'lucide-react';

export const BreakRuleConfig = () => {
    const { rules, updateRules } = usePlanner();

    const handleAddRule = () => {
        updateRules([
            ...rules,
            { minHours: 0, maxHours: 0, paidBreaks: 0, unpaidBreaks: 0, paidDuration: 15, unpaidDuration: 30 }
        ]);
    };

    const handleUpdateRule = (index, field, value) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: value };
        updateRules(newRules);
    };

    const handleRemoveRule = (index) => {
        const newRules = rules.filter((_, i) => i !== index);
        updateRules(newRules);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">Break Rules</h2>
                <Button onClick={handleAddRule} variant="secondary"><Plus className="w-4 h-4" /> Add Rule Group</Button>
            </div>

            {rules.map((rule, index) => (
                <Card key={index} className="relative">
                    <button
                        onClick={() => handleRemoveRule(index)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="space-y-6">
                        {/* Shift Length Condition */}
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-700 w-32 shrink-0">Shift Duration</h3>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    className="w-20"
                                    value={rule.minHours}
                                    onChange={(e) => handleUpdateRule(index, 'minHours', parseFloat(e.target.value))}
                                />
                                <span className="text-slate-400">-</span>
                                <Input
                                    type="number"
                                    className="w-20"
                                    value={rule.maxHours}
                                    onChange={(e) => handleUpdateRule(index, 'maxHours', parseFloat(e.target.value))}
                                />
                                <span className="text-sm font-medium text-slate-500">hours</span>
                            </div>
                        </div>

                        {/* Break Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Paid Breaks */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-indigo-600 font-medium text-sm">
                                    <DollarSign className="w-4 h-4" /> Paid Rest Breaks
                                </div>
                                <div className="flex items-center gap-4 pl-6">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Count</label>
                                        <Input
                                            type="number"
                                            className="w-20"
                                            value={rule.paidBreaks || 0}
                                            onChange={(e) => handleUpdateRule(index, 'paidBreaks', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Minutes</label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                className="w-20"
                                                value={rule.paidDuration || 15}
                                                onChange={(e) => handleUpdateRule(index, 'paidDuration', parseInt(e.target.value))}
                                            />
                                            <span className="text-xs text-slate-500">ea.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Unpaid Breaks */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-orange-600 font-medium text-sm">
                                    <Coffee className="w-4 h-4" /> Unpaid Meal Breaks
                                </div>
                                <div className="flex items-center gap-4 pl-6">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Count</label>
                                        <Input
                                            type="number"
                                            className="w-20"
                                            value={rule.unpaidBreaks || 0}
                                            onChange={(e) => handleUpdateRule(index, 'unpaidBreaks', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Minutes</label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                className="w-20"
                                                value={rule.unpaidDuration || 30}
                                                onChange={(e) => handleUpdateRule(index, 'unpaidDuration', parseInt(e.target.value))}
                                            />
                                            <span className="text-xs text-slate-500">ea.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};
