import React from 'react';
import { cn } from '../../utils/cn'; // Need to create cn utility first actually, but I will make it next.

export const Button = ({ children, variant = 'primary', className, ...props }) => {
    const variants = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
        secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
        danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
        ghost: 'text-slate-600 hover:bg-slate-100',
    };

    return (
        <button
            className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};
