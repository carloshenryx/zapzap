// DEPRECATED: This is a stub file to prevent 404 errors
// All Base44 functionality has been migrated to Supabase
// Do not use this file - it only exists to prevent import errors

/*console.warn(
    '[DEPRECATED] base44Client.js is being imported. ' +
    'This functionality has been migrated to Supabase. ' +
    'Please update your imports to use @/lib/AuthContext and @/lib/supabase instead.'
);*/

// Empty export to prevent errors
export const base44 = {
    auth: {
        me: () => Promise.reject(new Error('Base44 is deprecated - use Supabase')),
        redirectToLogin: () => console.error('Base44 is deprecated - use navigate("/login")'),
    },
    entities: new Proxy({}, {
        get: () => ({
            filter: () => Promise.reject(new Error('Base44 is deprecated - use Supabase')),
            create: () => Promise.reject(new Error('Base44 is deprecated - use Supabase')),
            update: () => Promise.reject(new Error('Base44 is deprecated - use Supabase')),
            delete: () => Promise.reject(new Error('Base44 is deprecated - use Supabase')),
        })
    }),
    appLogs: {
        logUserInApp: () => Promise.resolve(), // Silent fail for logging
    }
};

export default base44;
