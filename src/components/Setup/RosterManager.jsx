import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trash2, Plus, User, Briefcase } from 'lucide-react';

export const RosterManager = () => {
    const { roster, addToRoster, deleteFromRoster, updateRosterEmployee } = usePlanner();
    const [isAdding, setIsAdding] = useState(false);
    const [newEmp, setNewEmp] = useState({ name: '', defaultRole: 'Product Guide' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', defaultRole: '' });

    const handleAddSubmit = (e) => {
        e.preventDefault();
        if (newEmp.name.trim()) {
            addToRoster(newEmp);
            setNewEmp({ name: '', defaultRole: 'Product Guide' });
            setIsAdding(false);
        }
    };

    const startEditing = (emp) => {
        setEditingId(emp.id);
        setEditForm({ name: emp.name, defaultRole: emp.defaultRole, avatarColor: emp.avatarColor });
    };

    const saveEdit = (id) => {
        if (editForm.name.trim()) {
            updateRosterEmployee(id, editForm);
            setEditingId(null);
        }
    };

    // --- Color Picker ---
    const AVATAR_COLORS = [
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#84cc16', // Lime
        '#10b981', // Emerald
        '#06b6d4', // Cyan
        '#3b82f6', // Blue
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#d946ef', // Fuchsia
        '#f43f5e', // Rose
        '#64748b'  // Slate
    ];

    const ColorPicker = ({ value, onChange }) => (
        <div className="flex flex-wrap gap-2 mt-2">
            {AVATAR_COLORS.map(c => (
                <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${value === c ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
        </div>
    );

    return (
        <Card title="Employee Roster" actions={<Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "secondary" : "primary"}><Plus className="w-4 h-4" /> {isAdding ? 'Cancel' : 'Add Person'}</Button>}>
            <div className="space-y-4">
                {isAdding && (
                    <form onSubmit={handleAddSubmit} className="flex flex-col gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-indigo-700 uppercase mb-1 block">Full Name</label>
                                <Input
                                    autoFocus
                                    value={newEmp.name}
                                    onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                                    placeholder="Jane Doe"
                                    className="bg-white"
                                />
                            </div>
                            <div className="w-48">
                                <label className="text-xs font-semibold text-indigo-700 uppercase mb-1 block">Default Role</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newEmp.defaultRole}
                                    onChange={(e) => setNewEmp({ ...newEmp, defaultRole: e.target.value })}
                                >
                                    <option value="Manager">Manager</option>
                                    <option value="Lead">Lead</option>
                                    <option value="Product Guide">Product Guide</option>
                                    <option value="Associate">Associate</option>
                                </select>
                            </div>
                            <Button type="submit">Save</Button>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-indigo-700 uppercase mb-1 block">Profile Color</label>
                            <ColorPicker value={newEmp.avatarColor || AVATAR_COLORS[7]} onChange={(c) => setNewEmp({ ...newEmp, avatarColor: c })} />
                        </div>
                    </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {roster.map((emp) => (
                        <div key={emp.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors group bg-white">
                            {editingId === emp.id ? (
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="h-8 text-sm"
                                        />
                                        <select
                                            className="px-2 py-1 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editForm.defaultRole}
                                            onChange={(e) => setEditForm({ ...editForm, defaultRole: e.target.value })}
                                        >
                                            <option value="Manager">Manager</option>
                                            <option value="Lead">Lead</option>
                                            <option value="Product Guide">Product Guide</option>
                                            <option value="Associate">Associate</option>
                                        </select>
                                        <Button size="sm" onClick={() => saveEdit(emp.id)}>Save</Button>
                                    </div>
                                    <ColorPicker value={editForm.avatarColor} onChange={(c) => setEditForm({ ...editForm, avatarColor: c })} />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => startEditing(emp)}>
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors border border-black/5"
                                            style={{ backgroundColor: emp.avatarColor || '#f1f5f9', color: emp.avatarColor ? '#fff' : '#64748b' }}
                                        >
                                            {emp.avatarColor ? <User className="w-4 h-4 text-white" /> : <User className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900">{emp.name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <Briefcase className="w-3 h-3" /> {emp.defaultRole}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => deleteFromRoster(emp.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        title="Remove from Roster"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}

                    {roster.length === 0 && !isAdding && (
                        <div className="col-span-2 text-center py-8 text-slate-400 italic">
                            Roster is empty. Add employees to quick-add them to daily schedules.
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};
