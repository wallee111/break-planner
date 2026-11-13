import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, Lock, AlertCircle, BarChart2, KeyRound } from 'lucide-react';

const ErrorBox = ({ children }) => (
    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {children}
    </div>
);

const MessageBox = ({ children }) => (
    <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {children}
    </div>
);

export const LoginScreen = () => {
    const {
        signIn,
        signUp,
        requestPasswordReset,
        updatePassword,
        completePasswordReset,
        passwordResetPending
    } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [showForgot, setShowForgot] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const clearFeedback = () => {
        setError('');
        setMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        clearFeedback();

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                const { user } = await signUp(email, password);
                if (user && !user.email_confirmed_at) {
                    setMessage('Check your email for the confirmation link!');
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        clearFeedback();

        try {
            await requestPasswordReset(email);
            setShowForgot(false);
            setMessage('Reset link sent — check your inbox');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSetPasswordSubmit = async (e) => {
        e.preventDefault();
        clearFeedback();

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await updatePassword(newPassword);
            setMessage('Password updated! Signing you in...');
            setTimeout(() => completePasswordReset(), 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsLogin(!isLogin);
        setShowForgot(false);
        clearFeedback();
    };

    const openForgot = () => {
        setShowForgot(true);
        clearFeedback();
    };

    // Recovery session detected: user clicked the emailed reset link.
    if (passwordResetPending) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                            <KeyRound className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Set New Password</h1>
                        <p className="text-slate-500">Choose a new password for your account</p>
                    </div>

                    <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
                        {error && <ErrorBox>{error}</ErrorBox>}
                        {message && <MessageBox>{message}</MessageBox>}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">New Password</label>
                            <div className="relative">
                                <Input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="pl-10 pr-4 py-2 border-slate-200"
                                    placeholder="••••••••"
                                />
                                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                            <div className="relative">
                                <Input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-4 py-2 border-slate-200"
                                    placeholder="••••••••"
                                />
                                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <Button type="submit" className="w-full justify-center" disabled={loading}>
                            {loading ? 'Updating...' : 'Update Password'}
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    // Forgot-password inline form.
    if (showForgot) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                            <KeyRound className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
                        <p className="text-slate-500">Enter your email and we'll send you a reset link</p>
                    </div>

                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                        {error && <ErrorBox>{error}</ErrorBox>}
                        {message && <MessageBox>{message}</MessageBox>}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Email</label>
                            <div className="relative">
                                <Input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 pr-4 py-2 border-slate-200"
                                    placeholder="name@company.com"
                                />
                                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button type="submit" className="flex-1 justify-center" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowForgot(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>

                    <div className="text-center pt-4 border-t border-slate-100">
                        <button
                            onClick={() => setShowForgot(false)}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            Back to sign in
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                        <BarChart2 className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="text-slate-500">
                        {isLogin ? 'Sign in to access your break planner' : 'Get started with optimized scheduling'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <ErrorBox>{error}</ErrorBox>}
                    {message && <MessageBox>{message}</MessageBox>}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email</label>
                        <div className="relative">
                            <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Password</label>
                        <div className="relative">
                            <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {isLogin && (
                        <div className="text-right">
                            <button
                                type="button"
                                onClick={openForgot}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    <Button type="submit" className="w-full justify-center" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </Button>
                </form>

                <div className="text-center pt-4 border-t border-slate-100">
                    <button
                        onClick={switchMode}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
};
