import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Generic wording on purpose: never embed the backend URL in error strings.
const NETWORK_ERROR_MESSAGE =
    'Cannot reach the server — the backend may be paused or offline. Check the Supabase project status.';

// Fetch-level failures surface as TypeError ("Failed to fetch"), a Supabase
// AuthRetryableFetchError ("fetch failed"), or a raw browser network code.
const isNetworkError = (err) => {
    if (!err) return false;
    const name = err.name || '';
    const message = err.message || '';
    return (
        name === 'TypeError' ||
        name === 'AuthRetryableFetchError' ||
        message.includes('Failed to fetch') ||
        message.includes('fetch failed') ||
        message.includes('NetworkError') ||
        message.includes('ERR_NAME_NOT_RESOLVED') ||
        message.includes('Load failed')
    );
};

// Re-throw with a friendly message for network-level failures; pass
// everything else (Supabase AuthApiError etc.) through untouched.
const toFriendlyError = (err) => {
    if (isNetworkError(err)) {
        return new Error(NETWORK_ERROR_MESSAGE);
    }
    return err;
};

// Recovery links land with ?type=recovery (code flow) or #type=recovery
// (implicit flow). Used as a fallback when the auth event was missed.
const isRecoveryUrl = () => {
    if (typeof window === 'undefined') return false;
    const query = new URLSearchParams(window.location.search);
    if (query.get('type') === 'recovery' || query.get('recovery_type') === 'recovery') {
        return true;
    }
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return hashParams.get('type') === 'recovery' || hashParams.get('recovery_type') === 'recovery';
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [passwordResetPending, setPasswordResetPending] = useState(false);

    useEffect(() => {
        // Check active sessions and sets the user
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            if (session?.user && isRecoveryUrl()) {
                setPasswordResetPending(true);
            }
            setLoading(false);
        };
        getSession();

        // Listen for changes on auth state (login, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user ?? null);
                if (event === 'PASSWORD_RECOVERY') {
                    setPasswordResetPending(true);
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            return data;
        } catch (err) {
            throw toFriendlyError(err);
        }
    };

    const signUp = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
            return data;
        } catch (err) {
            throw toFriendlyError(err);
        }
    };

    const requestPasswordReset = async (email) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) throw error;
        } catch (err) {
            throw toFriendlyError(err);
        }
    };

    const updatePassword = async (password) => {
        try {
            const { data, error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            return data;
        } catch (err) {
            throw toFriendlyError(err);
        }
    };

    const completePasswordReset = () => {
        setPasswordResetPending(false);
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        // Use loose check for 403 or message content to catch "AuthSessionMissingError"
        if (error && error.status != 403 && !error.message?.includes('session missing')) {
            throw error;
        }
    };

    const value = {
        user,
        loading,
        passwordResetPending,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        completePasswordReset
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading ? children : <div className="min-h-screen flex items-center justify-center text-slate-500">Loading auth...</div>}
        </AuthContext.Provider>
    );
};
