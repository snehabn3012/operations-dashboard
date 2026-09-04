import { useCallback, useState } from "react";

import { useGetDashboardModulesByIdQuery } from "@/store/api/dashboardApi";

const PAGE_SIZE = 9;

/**
 * Same pagination coordination as useInfiniteModules, but for the
 * id-addressed /dashboard/[id] route -- kept as a separate small hook rather
 * than generalizing useInfiniteModules(role) to accept role-or-id, so the
 * existing, already-tested role-based path stays completely untouched.
 */
export function useInfiniteModulesById(dashboardId: string) {
  const [page, setPage] = useState(1);

  const [trackedId, setTrackedId] = useState(dashboardId);
  if (dashboardId !== trackedId) {
    setTrackedId(dashboardId);
    setPage(1);
  }

  const { data, isLoading, isFetching, error, refetch } = useGetDashboardModulesByIdQuery({
    dashboardId,
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
