import React from 'react';
import { Calendar, Users, Settings, BarChart2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export const MainLayout = ({ children }) => {
    const [activeTab, setActiveTab] = React.useState('schedule');

    const navItems = [
        { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'rules', label: 'Parameters', icon: Settings },
        { id: 'profile', label: 'Profile', icon: Users },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-10 hidden md:block">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3 text-indigo-600">
                        <BarChart2 className="w-8 h-8" />
                        <span className="font-bold text-xl tracking-tight">BreakPlan</span>
                    </div>
                </div>
                <nav className="p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">
                            {navItems.find(t => t.id === activeTab)?.label}
                        </h1>
                        <p className="text-slate-500 mt-2">Manage your team and generate optimized schedules.</p>
                    </header>

                    {/* We will route content here based on activeTab later, effectively passing it down or simple conditional rendering */}
                    {children(activeTab, setActiveTab)}
                </div>
            </main>
        </div>
    );
};
