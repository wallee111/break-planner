import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Palette } from 'lucide-react';

export const RoleColorConfig = () => {
    const { roleColors, updateRoleColor } = usePlanner();

    // Get unique roles from config + generic ones
    const roles = Object.keys(roleColors);

    return (
        <Card title="Role Appearances">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {roles.map(role => (
                    <div key={role} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                        <div
                            className="w-8 h-8 rounded-full border border-slate-200 shadow-sm shrink-0"
                            style={{ backgroundColor: roleColors[role] }}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{role}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <Palette className="w-3 h-3 text-slate-400" />
                                <input
                                    type="color"
                                    value={roleColors[role]}
                                    onChange={(e) => updateRoleColor(role, e.target.value)}
                                    className="w-6 h-6 p-0 border-0 rounded overflow-hidden cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};
