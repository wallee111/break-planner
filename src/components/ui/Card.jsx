import React from 'react';
import { cn } from '../../utils/cn';

export const Card = ({ children, className, title, actions }) => {
    return (
        <div className={cn('bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden', className)}>
            {(title || actions) && (
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    {title && <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>}
                    {actions && <div className="flex gap-2">{actions}</div>}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};
