import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Bar that slides up from the bottom while the Parameters tab has unsaved
 * edits. It stays mounted and animates via transform so it can slide both in
 * and out; while hidden it is inert (not focusable or clickable).
 */
export const UnsavedChangesBar = ({ visible, error, blocked, saving, onSave, onDiscard }) => (
    <div
        className={cn(
            'fixed bottom-0 right-0 left-0 md:left-64 z-40 flex justify-center px-4 pb-6 pointer-events-none',
            'transition-transform duration-300 ease-out motion-reduce:transition-none',
            visible ? 'translate-y-0' : 'translate-y-[calc(100%+1.5rem)]'
        )}
        aria-hidden={!visible}
        inert={!visible}
        data-testid="unsaved-bar"
        data-visible={visible ? 'true' : 'false'}
    >
        <div
            role="region"
            aria-label="Unsaved changes"
            className="pointer-events-auto w-full max-w-3xl flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-3"
        >
            <div className="flex-1 min-w-0 text-sm">
                <div className="font-medium">You have unsaved changes</div>
                {error && (
                    <div className="text-amber-300 text-xs mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
                    </div>
                )}
            </div>
            <div className="flex gap-2 shrink-0">
                <button
                    onClick={onDiscard}
                    disabled={saving}
                    className="h-9 px-4 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                    Discard
                </button>
                <button
                    onClick={onSave}
                    disabled={saving || blocked}
                    className="h-9 px-4 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </div>
    </div>
);

/**
 * "Unsaved changes" popup shown when leaving the Parameters tab with edits.
 * Save & continue / Discard & continue / Keep editing (Esc or backdrop).
 */
export const LeaveWithUnsavedDialog = ({ open, targetLabel, error, blocked, saving, onSave, onDiscard, onCancel }) => {
    const saveRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        saveRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape' && !saving) onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, saving, onCancel]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="leave-dialog">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => !saving && onCancel()} />
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="leave-dialog-title"
                aria-describedby="leave-dialog-body"
                className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6"
            >
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-amber-50 text-amber-600 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 id="leave-dialog-title" className="text-lg font-semibold text-slate-900">Unsaved changes</h2>
                        <p id="leave-dialog-body" className="text-sm text-slate-600 mt-1">
                            You changed your parameters but haven't saved. Save them before going to {targetLabel}?
                        </p>
                        {error && (
                            <p className="text-sm text-red-600 mt-2">{error}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                    <button
                        onClick={onCancel}
                        disabled={saving}
                        className="h-9 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                        Keep editing
                    </button>
                    <button
                        onClick={onDiscard}
                        disabled={saving}
                        className="h-9 px-4 rounded-lg text-sm font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                        Discard changes
                    </button>
                    <button
                        ref={saveRef}
                        onClick={onSave}
                        disabled={saving || blocked}
                        className="h-9 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Saving…' : 'Save & continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};
