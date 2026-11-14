import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Users, Settings, BarChart2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { usePlanner } from '../../context/PlannerContext';
import { UnsavedChangesBar, LeaveWithUnsavedDialog } from './UnsavedChanges';

const navItems = [
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'rules', label: 'Parameters', icon: Settings },
    { id: 'profile', label: 'Profile', icon: Users },
];

export const MainLayout = ({ children }) => {
    const [activeTab, setActiveTab] = React.useState('schedule');
    const { paramsDirty, paramsError, saveParams, discardParams } = usePlanner();

    // Unsaved Parameters edits: tab the user tried to open (dialog open while set)
    const [pendingTab, setPendingTab] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    const onParams = activeTab === 'rules';
    const showBar = onParams && paramsDirty;
    const saveErrorText = paramsError
        || (saveFailed ? 'Couldn\'t save. Check your connection and try again.' : null);

    const requestTab = (id) => {
        if (id === activeTab) return;
        if (onParams && paramsDirty) {
            setSaveFailed(false);
            setPendingTab(id); // ask first
            return;
        }
        setActiveTab(id);
    };

    const save = async () => {
        setSaving(true);
        setSaveFailed(false);
        const ok = await saveParams();
        setSaving(false);
        if (!ok) setSaveFailed(true);
        else setSavedToast(n => (n || 0) + 1); // confirmation only after a verified save
        return ok;
    };

    // "Parameters saved" popup: shown only when the database confirmed the
    // save; hides itself after a few seconds.
    const [savedToast, setSavedToast] = useState(null);
    useEffect(() => {
        if (!savedToast) return;
        const t = setTimeout(() => setSavedToast(null), 3500);
        return () => clearTimeout(t);
    }, [savedToast]);

    const saveAndLeave = async () => {
        if (await save()) {
            setActiveTab(pendingTab);
            setPendingTab(null);
        }
    };

    const discardAndLeave = () => {
        discardParams();
        setSaveFailed(false);
        setActiveTab(pendingTab);
        setPendingTab(null);
    };

    const cancelLeave = useCallback(() => setPendingTab(null), []);

    // Browser reload/close with unsaved edits: the browser shows its own
    // "Leave site?" prompt (custom text isn't allowed there).
    useEffect(() => {
        if (!paramsDirty) return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [paramsDirty]);

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
                                onClick={() => requestTab(item.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                                {item.id === 'rules' && paramsDirty && (
                                    <span className="ml-auto w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content (extra bottom padding while the save bar is up so it never covers the last card) */}
            <main className={cn('flex-1 md:ml-64 p-8 transition-[padding] duration-300', showBar && 'pb-32')}>
                <div className="max-w-5xl mx-auto space-y-8">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">
                            {navItems.find(t => t.id === activeTab)?.label}
                        </h1>
                        <p className="text-slate-500 mt-2">Manage your team and generate optimized schedules.</p>
                    </header>

                    {children(activeTab, requestTab)}
                </div>
            </main>

            <UnsavedChangesBar
                visible={showBar && !pendingTab}
                error={saveErrorText}
                blocked={!!paramsError}
                saving={saving}
                onSave={save}
                onDiscard={() => { discardParams(); setSaveFailed(false); }}
            />

            {savedToast && (
                <div className="fixed top-4 right-4 z-50 toast-in" role="status" aria-live="polite" data-testid="saved-toast">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm border text-emerald-700 bg-emerald-50 border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Parameters saved</span>
                        <button
                            onClick={() => setSavedToast(null)}
                            className="ml-1 text-current opacity-50 hover:opacity-100"
                            aria-label="Close saved message"
                        >✕</button>
                    </div>
                </div>
            )}

            <LeaveWithUnsavedDialog
                open={!!pendingTab}
                targetLabel={navItems.find(t => t.id === pendingTab)?.label}
                error={saveErrorText}
                blocked={!!paramsError}
                saving={saving}
                onSave={saveAndLeave}
                onDiscard={discardAndLeave}
                onCancel={cancelLeave}
            />
        </div>
    );
};
