import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LogOut, User, Mail } from 'lucide-react';

export const UserProfile = () => {
    const { user, signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <Card title="User Profile">
            <div className="space-y-8 max-w-md">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium">Signed in as</div>
                        <div className="text-slate-900 font-semibold flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {user?.email}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-center text-red-600 hover:bg-red-50 hover:border-red-200 border-slate-200">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </div>
            </div>
        </Card>
    );
};
