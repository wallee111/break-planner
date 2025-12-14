import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trash2, Plus, Clock } from 'lucide-react';

export const BreakRuleConfig = () => {
    const { rules, updateRules } = usePlanner();

    const handleAddRule = () => {
        updateRules([
            ...rules,
            { minHours: 0, maxHours: 0, breaks: [] }
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

    const handleAddBreak = (ruleIndex) => {
        const newRules = [...rules];
        newRules[ruleIndex].breaks.push({ duration: 15, type: 'paid' });
        updateRules(newRules);
    };

    const handleRemoveBreak = (ruleIndex, breakIndex) => {
        const newRules = [...rules];
        newRules[ruleIndex].breaks = newRules[ruleIndex].breaks.filter((_, i) => i !== breakIndex);
        updateRules(newRules);
    };

    const handleUpdateBreak = (ruleIndex, breakIndex, field, value) => {
        const newRules = [...rules];
        newRules[ruleIndex].breaks[breakIndex] = { ...newRules[ruleIndex].breaks[breakIndex], [field]: value };
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

                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">Shift Length:</span>
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
                    </div>

                    <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                        {rule.breaks.map((brk, bIndex) => (
                            <div key={bIndex} className="flex items-center gap-4">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        className="w-20 py-1"
                                        value={brk.duration}
                                        onChange={(e) => handleUpdateBreak(index, bIndex, 'duration', parseInt(e.target.value))}
                                    />
                                    <span className="text-sm text-slate-600">min</span>
                                </div>

                                <select
                                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700"
                                    value={brk.type}
                                    onChange={(e) => handleUpdateBreak(index, bIndex, 'type', e.target.value)}
                                >
                                    <option value="paid">Paid Break</option>
                                    <option value="meal">Unpaid Meal</option>
                                </select>

                                <button
                                    onClick={() => handleRemoveBreak(index, bIndex)}
                                    className="text-slate-400 hover:text-red-500"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={() => handleAddBreak(index)}
                            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Add Break
                        </button>
                    </div>
                </Card>
            ))}
        </div>
    );
};
