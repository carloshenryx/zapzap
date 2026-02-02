import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { perfMark, perfMeasure } from '@/lib/perf';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);
    const isDev = !!import.meta?.env?.DEV;
    const inFlight = useRef({ userId: null, promise: null });

    const reportAuthReady = () => {
        const endMark = 'auth_ready';
        perfMark(endMark);
        let startMark = null;
        let page = null;
        try {
            startMark = sessionStorage.getItem('last_route_mark');
            page = sessionStorage.getItem('last_page_name');
        } catch (_) {}
        if (startMark) {
            perfMeasure({ name: 'route_to_auth_ready', startMark, endMark, extra: { page } });
        }
    };

    const buildFallbackProfile = (authUser) => {
        const meta = authUser?.app_metadata || {};
        const tenantId = meta.tenant_id || null;
        if (!tenantId) return null;
        return {
            id: authUser.id,
            tenant_id: tenantId,
            is_super_admin: !!meta.is_super_admin,
        };
    };

    const withTimeout = (promise, ms) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
        ]);
    };

    const fetchFullProfile = async (authUser) => {
        try {
            const loadFromApi = async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return null;

                const res = await fetch('/api/auth?action=context', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });

                if (!res.ok) return null;
                const payload = await res.json().catch(() => null);
                const profile = payload?.profile || null;
                const tenantId = payload?.tenant_id || profile?.tenant_id || null;
                if (!profile && !tenantId) return null;

                return {
                    ...(profile || {}),
                    id: profile?.id || authUser.id,
                    tenant_id: tenantId,
                    is_super_admin: !!(payload?.is_super_admin ?? profile?.is_super_admin),
                    email: profile?.email || authUser.email || null,
                    full_name: profile?.full_name || authUser?.user_metadata?.full_name || null,
                };
            };

            const fromApi = await withTimeout(loadFromApi(), 8000);
            if (fromApi?.id) return fromApi;

            const query = () =>
                supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', authUser.id)
                    .single();

            const firstTry = await withTimeout(query(), 8000);
            const { data: profile, error } = firstTry || {};

            if (error) {
                if (isDev) console.warn('Profile query error:', error.message);
                return null;
            }

            if (!profile) return null;
            return {
                ...profile,
                email: profile.email || authUser.email || null,
                full_name: profile.full_name || authUser?.user_metadata?.full_name || null,
            };
        } catch (err) {
            if (isDev) console.error('Profile timeout/error:', err?.message || err);
            return null;
        }
    };

    const loadUserProfile = async (authUser) => {
        if (!authUser?.id) {
            setUser(null);
            setUserProfile(null);
            setIsAuthenticated(false);
            setIsLoadingAuth(false);
            return;
        }

        setAuthError(null);
        const fallbackProfile = buildFallbackProfile(authUser);

        if (fallbackProfile) {
            setUser(authUser);
            setUserProfile(fallbackProfile);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            reportAuthReady();

            void fetchFullProfile(authUser).then((profile) => {
                if (profile?.tenant_id) {
                    setUserProfile(profile);
                }
            });
            return;
        }

        setIsLoadingAuth(true);
        const profile = await fetchFullProfile(authUser);
        setUser(authUser);
        setUserProfile(profile);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        reportAuthReady();
    };

    useEffect(() => {
        const runLoadOnce = (authUser) => {
            if (!authUser?.id) {
                inFlight.current = { userId: null, promise: null };
                setUser(null);
                setUserProfile(null);
                setIsAuthenticated(false);
                setIsLoadingAuth(false);
                return Promise.resolve();
            }

            const current = inFlight.current;
            if (current.promise && current.userId === authUser.id) return current.promise;

            const p = Promise.resolve(loadUserProfile(authUser)).finally(() => {
                if (inFlight.current.userId === authUser.id) {
                    inFlight.current.promise = null;
                }
            });

            inFlight.current = { userId: authUser.id, promise: p };
            return p;
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (isDev) console.log('Auth event:', event);

            if (event === 'SIGNED_OUT') {
                inFlight.current = { userId: null, promise: null };
                setUser(null);
                setUserProfile(null);
                setIsAuthenticated(false);
                setIsLoadingAuth(false);
                return;
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                await runLoadOnce(session?.user || null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signUp = async (email, password, metadata = {}) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata,
                },
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data?.user && data?.session?.user) {
                await loadUserProfile(data.session.user);
            }

            return { success: true, data };
        } catch (err) {
            return { success: false, error: err?.message || 'Erro ao criar conta' };
        }
    };

    const resetPassword = async (email) => {
        try {
            const redirectTo = `${window.location.origin}/login`;
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) {
                return { success: false, error: error.message };
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: err?.message || 'Erro ao enviar email de recuperação' };
        }
    };

    const value = {
        user,
        userProfile,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        navigateToLogin: () => {
            window.location.href = '/Login';
        },
        loadUserProfile,
        signUp,
        resetPassword,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
