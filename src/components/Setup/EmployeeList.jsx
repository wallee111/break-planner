import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trash2, Plus, GripVertical } from 'lucide-react';

export const EmployeeList = () => {
    const { employees, addEmployee, updateEmployee, removeEmployee, roster, clearTeam } = usePlanner();

    const handleAddField = () => {
        addEmployee({
            name: '',
            roles: [],
            startTime: '09:00',
            endTime: '17:00'
        });
    };

    return (
        <Card title="Team & Shifts" actions={
            <div className="flex gap-2">
                {roster.length > 0 && (
                    <select
                        className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onChange={(e) => {
                            const selectedId = e.target.value;
                            if (selectedId) {
                                const rosterEmp = roster.find(r => r.id === selectedId);
                                if (rosterEmp) {
                                    addEmployee({
                                        name: rosterEmp.name,
                                        roles: [rosterEmp.defaultRole || rosterEmp.role], // Handle legacy schema if needed
                                        startTime: '09:00',
                                        endTime: '17:00'
                                    });
                                }
                                e.target.value = ''; // Reset
                            }
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>+ Quick Add from Roster</option>
                        {roster.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.defaultRole || r.role})</option>
                        ))}
                    </select>
                )}
                <Button onClick={clearTeam} variant="secondary" className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"><Trash2 className="w-4 h-4" /> Clear All</Button>
                <Button onClick={handleAddField} variant="secondary"><Plus className="w-4 h-4" /> Add Empty Row</Button>
            </div >
        }>
            <div className="space-y-4">
                {employees.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        No employees added yet. Click "Add Employee" to start.
                    </div>
                )}

                {employees.map((emp) => (
                    <div key={emp.id} className="group flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all duration-200">
                        <div className="text-slate-300 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5" />
                        </div>

                        <div className="flex-1 grid grid-cols-12 gap-4">
                            <div className="col-span-4">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Name</label>
                                <Input
                                    value={emp.name}
                                    onChange={(e) => updateEmployee(emp.id, { name: e.target.value })}
                                    placeholder="e.g. Alex Smith"
                                    className="bg-white"
                                />
                            </div>

                            <div className="col-span-3">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Role</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={emp.roles[0] || ''}
                                    onChange={(e) => updateEmployee(emp.id, { roles: [e.target.value] })}
                                >
                                    <option value="">Select Role</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Lead">Lead</option>
                                    <option value="Product Guide">Product Guide</option>
                                </select>
                            </div>

                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Start</label>
                                <Input
                                    type="time"
                                    value={emp.startTime}
                                    onChange={(e) => updateEmployee(emp.id, { startTime: e.target.value })}
                                    className="bg-white"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">End</label>
                                <Input
                                    type="time"
                                    value={emp.endTime}
                                    onChange={(e) => updateEmployee(emp.id, { endTime: e.target.value })}
                                    className="bg-white"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => removeEmployee(emp.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>
        </Card >
    );
};
