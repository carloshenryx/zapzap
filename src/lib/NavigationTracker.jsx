import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
// import { base44 } from '@/api/base44Client'; // DEPRECATED
import { pagesConfig } from '@/pages.config';
import { perfLog, perfMark } from '@/lib/perf';

export default function NavigationTracker() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    // Log user activity when navigating to a page
    useEffect(() => {
        // Extract page name from pathname
        const pathname = location.pathname;
        let pageName;

        if (pathname === '/' || pathname === '') {
            pageName = mainPageKey;
        } else {
            // Remove leading slash and get the first segment
            const pathSegment = pathname.replace(/^\//, '').split('/')[0];

            // Try case-insensitive lookup in Pages config
            const pageKeys = Object.keys(Pages);
            const matchedKey = pageKeys.find(
                key => key.toLowerCase() === pathSegment.toLowerCase()
            );

            pageName = matchedKey || null;
        }

        if (isAuthenticated && pageName) {
            // Logging disabled - can be re-implemented with Supabase
            // base44.appLogs.logUserInApp(pageName).catch(() => {});
        }

        const pageKey = pageName || pathname || 'unknown';
        const markName = `route_start:${pageKey}`;
        perfMark(markName);
        try {
            sessionStorage.setItem('last_page_name', pageKey);
            sessionStorage.setItem('last_route_mark', markName);
        } catch (_) {}
        perfLog({ name: 'route_start', page: pageKey, path: pathname });
    }, [location, isAuthenticated, Pages, mainPageKey]);

    return null;
}
