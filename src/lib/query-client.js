import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// CRITICAL: Prevent data loss and unnecessary refetches when switching browser tabs
			refetchOnWindowFocus: false,
			// Keep data fresh for 5 minutes before considering it stale
			staleTime: 5 * 60 * 1000,
			// Keep unused data in cache for 10 minutes (renamed from cacheTime in v5)
			gcTime: 10 * 60 * 1000,
			// Retry failed queries once
			retry: 1,
			// Don't refetch on component mount if data is still fresh
			refetchOnMount: false,
		},
	},
});