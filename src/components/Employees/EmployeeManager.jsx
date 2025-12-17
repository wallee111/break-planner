import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Plus, Trash2, Edit2, Save, X, User, Clock, Briefcase, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../ui/Button';

import { HexColorPicker } from 'react-colorful';

const ColorPicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popover = useRef();

    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popover.current && !popover.current.contains(event.target)) {
                close();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, close]);

    return (
        <div className="relative mt-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-10 h-10 rounded-full border-2 border-slate-200 shadow-sm transition-transform active:scale-95"
                    style={{ backgroundColor: value || '#6366f1' }}
                />
                <span className="text-xs text-slate-500">
                    {isOpen ? 'Select color...' : 'Click to change color'}
                </span>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in zoom-in-95" ref={popover}>
                    <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200">
                        <HexColorPicker color={value || '#6366f1'} onChange={onChange} />
                        {/* Preset Swatches for convenience - optional, but nice to keep some defaults? User said "instead of limited amount", but maybe quick picks are good. Let's stick to just the picker as requested for now to be clean. */}
                    </div>
                </div>
            )}
        </div>
    );
};

export const EmployeeManager = () => {
    const { roster, addToRoster, updateRosterEmployee, deleteFromRoster, roleColors } = usePlanner();
    const [isAdding, setIsAdding] = useState(false);

    // Sort State
    const [sortConfig, setSortConfig] = useState(() => {
        const saved = localStorage.getItem('employee_manager_sort');
        return saved ? JSON.parse(saved) : { key: 'name', direction: 'asc' };
    });

    useEffect(() => {
        localStorage.setItem('employee_manager_sort', JSON.stringify(sortConfig));
    }, [sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedRoster = [...roster].sort((a, b) => {
        const aVal = sortConfig.key === 'role' ? (a.defaultRole || '') : (a.name || '');
        const bVal = sortConfig.key === 'role' ? (b.defaultRole || '') : (b.name || '');

        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();

        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // New Employee State
    const [newEmp, setNewEmp] = useState({
        name: '',
        defaultRole: 'Product Guide',
        weeklyHours: 40
    });

    const roles = ['Product Guide', 'Lead', 'Manager'];

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newEmp.name.trim()) return;

        await addToRoster({
            name: newEmp.name,
            defaultRole: newEmp.defaultRole,
            avatarColor: newEmp.avatarColor,
        }); // Context handles ID generation

        setIsAdding(false);
        setNewEmp({ name: '', defaultRole: 'Product Guide', weeklyHours: 40 });
    };

    const startEdit = (emp) => {
        setEditingId(emp.id);
        setEditForm({ ...emp });
    };

    const saveEdit = async () => {
        await updateRosterEmployee(editingId, editForm);
        setEditingId(null);
        setEditForm({});
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Team Roster</h2>
                    <p className="text-slate-500 text-sm">Manage your master list of employees.</p>
                </div>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" /> Add Employee
                    </Button>
                )}
            </header>

            {/* Add Form */}
            {isAdding && (
                <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> New Team Member
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                            <input
                                type="text"
                                value={newEmp.name}
                                onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 shadow-sm text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                placeholder="e.g. Sarah Connor"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Default Role</label>
                            <select
                                value={newEmp.defaultRole}
                                onChange={e => setNewEmp({ ...newEmp, defaultRole: e.target.value })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 shadow-sm text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            >
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                        <Button type="submit">Save Employee</Button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors group"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-1">
                                    Name
                                    {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                </div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors group"
                                onClick={() => handleSort('role')}
                            >
                                <div className="flex items-center gap-1">
                                    Default Role
                                    {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                </div>
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {sortedRoster.length === 0 && (
                            <tr>
                                <td colSpan="3" className="px-6 py-12 text-center text-slate-400 italic">
                                    Your roster is empty. Add employees to start scheduling.
                                </td>
                            </tr>
                        )}
                        {sortedRoster.map(emp => (
                            <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === emp.id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full h-9 px-2 rounded-md border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                            <ColorPicker
                                                value={editForm.avatarColor}
                                                onChange={c => setEditForm({ ...editForm, avatarColor: c })}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center">
                                            <div
                                                className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs mr-3 shadow-sm border border-black/5 transition-colors"
                                                style={{ backgroundColor: emp.avatarColor || '#6366f1' }}
                                            >
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div className="text-sm font-medium text-slate-900">{emp.name}</div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === emp.id ? (
                                        <select
                                            value={editForm.defaultRole}
                                            onChange={e => setEditForm({ ...editForm, defaultRole: e.target.value })}
                                            className="w-full h-9 px-2 rounded-md border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                                        >
                                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    ) : (
                                        <span
                                            style={{
                                                backgroundColor: roleColors?.[emp.defaultRole] || '#e2e8f0',
                                                color: '#ffffff',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                            }}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                        >
                                            {emp.defaultRole}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {editingId === emp.id ? (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-900"><Save className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => startEdit(emp)} className="text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => { if (confirm('Delete from roster?')) deleteFromRoster(emp.id); }} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
