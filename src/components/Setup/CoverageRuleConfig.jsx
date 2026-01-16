import React, { useState, useRef, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trash2, Plus, Shield, Check, ChevronsUpDown } from 'lucide-react';

export const CoverageRuleConfig = () => {
    const { coverageRules, updateCoverageRules, roleColors } = usePlanner();
    const availableRoles = Object.keys(roleColors || {});

    const handleAddRule = () => {
        updateCoverageRules([
            ...coverageRules,
            { type: 'min_staff', roles: ['Any'], operator: 'OR', count: 1 }
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

    const MultiSelect = ({ selected, onChange }) => {
        const [isOpen, setIsOpen] = useState(false);
        const ref = useRef(null);

        useEffect(() => {
            const handleClickOutside = (event) => {
                if (ref.current && !ref.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const toggleRole = (role) => {
            if (role === 'Any') {
                onChange(['Any']);
                return;
            }

            let newSelected = selected.filter(r => r !== 'Any');
            if (selected.includes(role)) {
                newSelected = newSelected.filter(r => r !== role);
            } else {
                newSelected = [...newSelected, role];
            }

            if (newSelected.length === 0) newSelected = ['Any'];
            onChange(newSelected);
        };

        return (
            <div className="relative" ref={ref}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between w-48 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <span className="truncate">
                        {selected.includes('Any') ? 'Any Role' : `${selected.length} Selected`}
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-slate-400" />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-56 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <div
                            className="px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center"
                            onClick={() => toggleRole('Any')}
                        >
                            <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selected.includes('Any') ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                {selected.includes('Any') && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm text-slate-700">Any Role</span>
                        </div>
                        <div className="border-t border-slate-100 my-1"></div>
                        {availableRoles.map(role => (
                            <div
                                key={role}
                                className="px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center"
                                onClick={() => toggleRole(role)}
                            >
                                <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selected.includes(role) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                    {selected.includes(role) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm text-slate-700">{role}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">Coverage Rules</h2>
                <Button onClick={handleAddRule} variant="secondary"><Plus className="w-4 h-4" /> Add Coverage Rule</Button>
            </div>

            <div className="grid gap-4">
                {coverageRules.map((rule, index) => {
                    // Normalize legacy rules
                    const currentRoles = rule.roles || (rule.role ? [rule.role] : ['Any']);
                    const currentOp = rule.operator || 'OR';

                    return (
                        <Card key={index} className="flex flex-col md:flex-row md:items-center gap-4 p-4 overflow-visible">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 w-fit">
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

                                <span className="text-sm font-medium text-slate-600 whitespace-nowrap">staff matching</span>

                                <div className="flex items-center gap-2">
                                    <select
                                        className="h-9 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                                        value={currentOp}
                                        onChange={(e) => handleUpdateRule(index, 'operator', e.target.value)}
                                    >
                                        <option value="OR">ANY OF (OR)</option>
                                        <option value="AND">ALL OF (AND)</option>
                                    </select>
                                </div>

                                <MultiSelect
                                    selected={currentRoles}
                                    onChange={(roles) => handleUpdateRule(index, 'roles', roles)}
                                />

                                <div className="flex flex-wrap gap-1">
                                    {currentRoles.filter(r => r !== 'Any').map(r => (
                                        <span key={r} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => handleRemoveRule(index)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
