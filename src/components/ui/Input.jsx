import React from 'react';
import { cn } from '../../utils/cn';

export const Input = ({ className, error, ...props }) => {
    return (
        <div className="w-full">
            <input
                className={cn(
                    'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow duration-200',
                    error && 'border-red-500 focus:ring-red-500',
                    className
                )}
                {...props}
            />
            {error && <span className="text-sm text-red-500 mt-1 block">{error}</span>}
        </div>
    );
};
