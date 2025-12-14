import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trash2, Plus, Users, Shield } from 'lucide-react';

export const CoverageRuleConfig = () => {
    const { coverageRules, updateCoverageRules } = usePlanner();

    const handleAddRule = () => {
        updateCoverageRules([
            ...coverageRules,
            { type: 'min_staff', role: 'Any', count: 1 }
        ]);
    };

    const handleUpdateRule = (index, field, value) => {
        const newRules = [...coverageRules];
        newRules[index] = { ...newRules[index], [field]: value };
        updateCoverageRules(newRules);
    };

    const handleRemoveRule = (index) => {
        const newRules = coverageRules.filter((_, i) => i !== index);
        updateCoverageRules(newRules);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">Coverage Rules</h2>
                <Button onClick={handleAddRule} variant="secondary"><Plus className="w-4 h-4" /> Add Coverage Rule</Button>
            </div>

            <div className="grid gap-4">
                {coverageRules.map((rule, index) => (
                    <Card key={index} className="flex items-center gap-4 p-4">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Shield className="w-5 h-5" />
                        </div>

                        <div className="flex-1 flex gap-3 items-center flex-wrap">
                            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Ensure at least</span>

                            <Input
                                type="number"
                                className="w-20 min-w-[80px]"
                                min="1"
                                value={rule.count}
                                onChange={(e) => handleUpdateRule(index, 'count', parseInt(e.target.value))}
                            />

                            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">staff with role</span>

                            <select
                                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40 min-w-[150px]"
                                value={rule.role}
                                onChange={(e) => handleUpdateRule(index, 'role', e.target.value)}
                            >
                                <option value="Any">Any Role</option>
                                <option value="Manager">Manager</option>
                                <option value="Lead">Lead</option>
                                <option value="Product Guide">Product Guide</option>
                            </select>

                            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">are strictly active.</span>
                        </div>

                        <button
                            onClick={() => handleRemoveRule(index)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </Card>
                ))}
            </div>
        </div>
    );
};
