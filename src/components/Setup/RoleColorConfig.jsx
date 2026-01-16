import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Palette, Trash2, Plus, Check, X } from 'lucide-react';

export const RoleColorConfig = () => {
    const { roleColors, updateRoleColor, addRole, renameRole, deleteRole } = usePlanner();
    const [newRoleName, setNewRoleName] = useState('');
    const [editingRole, setEditingRole] = useState(null);
    const [editName, setEditName] = useState('');

    // Sort to keep UI stable
    const roles = Object.keys(roleColors).sort();

    const handleAdd = () => {
        if (!newRoleName.trim()) return;
        addRole(newRoleName.trim());
        setNewRoleName('');
    };

    const startEdit = (role) => {
        setEditingRole(role);
        setEditName(role);
    };

    const saveEdit = () => {
        if (editName.trim() && editName !== editingRole) {
            renameRole(editingRole, editName.trim());
        }
        setEditingRole(null);
    };

    const handleDelete = (role) => {
        if (confirm(`Are you sure you want to delete the role "${role}"? This will remove it from all employees.`)) {
            deleteRole(role);
        }
    };

    return (
        <Card title="Roles">
            <div className="space-y-6">
                {/* Add Role */}
                <div className="flex gap-3 items-end p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">New Role Name</label>
                        <Input
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="e.g. Supervisor"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <Button onClick={handleAdd} disabled={!newRoleName.trim()}>
                        <Plus className="w-4 h-4 mr-2" /> Add Role
                    </Button>
                </div>

                {/* Role List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roles.map(role => (
                        <div key={role} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white shadow-sm hover:border-indigo-200 transition-colors group">
                            <div className="relative">
                                <div
                                    className="w-10 h-10 rounded-full border border-slate-200 shadow-sm shrink-0 flex items-center justify-center overflow-hidden"
                                    style={{ backgroundColor: roleColors[role] }}
                                >
                                    <input
                                        type="color"
                                        value={roleColors[role]}
                                        onChange={(e) => updateRoleColor(role, e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        title="Change Color"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                {editingRole === role ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-8 text-sm"
                                            autoFocus
                                            onBlur={saveEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="text-sm font-semibold text-slate-900 truncate cursor-pointer hover:text-indigo-600 flex items-center gap-2"
                                        onClick={() => startEdit(role)}
                                        title="Click to rename"
                                    >
                                        {role}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleDelete(role)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Role"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};
