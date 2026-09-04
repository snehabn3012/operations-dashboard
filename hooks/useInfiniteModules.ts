import { useCallback, useState } from "react";

import { useGetDashboardModulesQuery } from "@/store/api/dashboardApi";
import { Role } from "@/types/dashboard";

// Large enough that the first page fills a typical viewport on its own for
// most roles; the sentinel's IntersectionObserver still tops up further
// pages automatically if the loaded modules end up shorter than the screen
// (see LoadMoreSentinel), and only waits for a real scroll once content
// already exceeds the viewport.
const PAGE_SIZE = 9;

/**
 * Coordinates paginated module loading for the dashboard's infinite scroll.
 * RTK Query (see getDashboardModules in dashboardApi.ts) accumulates pages
 * into a single cache entry per role, so this hook only needs to own the
 * "which page are we on" cursor and expose a stable `loadMore`/`retry` API.
 */
export function useInfiniteModules(role: Role) {
  const [page, setPage] = useState(1);

  // Starting to view a different role's dashboard restarts pagination.
  // Adjusting state during render (rather than in an effect) avoids an
  // extra commit; React re-renders immediately with the reset value.
  const [trackedRole, setTrackedRole] = useState(role);
  if (role !== trackedRole) {
    setTrackedRole(role);
    setPage(1);
  }

  const { data, isLoading, isFetching, error, refetch } = useGetDashboardModulesQuery({
    role,
    page,
    limit: PAGE_SIZE,
  });

  const hasMore = data?.hasMore ?? true;
  const isInitialLoading = isLoading && page === 1;
  const isFetchingMore = isFetching && page > 1;
  const hasMoreError = Boolean(error) && page > 1;
  const hasInitialError = Boolean(error) && page === 1;

  const loadMore = useCallback(() => {
    if (isFetching || !hasMore) return;
    setPage((p) => p + 1);
  }, [isFetching, hasMore]);

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    modules: data?.modules ?? [],
    dashboardFilters: data?.dashboardFilters ?? [],
    total: data?.total ?? 0,
    isInitialLoading,
    isFetchingMore,
    hasMoreError,
    hasInitialError,
    hasMore,
    loadMore,
    retry,
  };
}
