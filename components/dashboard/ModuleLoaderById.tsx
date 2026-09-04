"use client";

import DashboardGrid from "@/components/dashboard/DashboardGrid";
import LoadMoreSentinel from "@/components/dashboard/LoadMoreSentinel";
import { useInfiniteModulesById } from "@/hooks/useInfiniteModulesById";

import styles from "./ModuleLoader.module.css";

interface ModuleLoaderByIdProps {
  dashboardId: string;
}

/** Same scroll-based pagination as ModuleLoader, but for the id-addressed /dashboard/[id] route. */
export default function ModuleLoaderById({ dashboardId }: ModuleLoaderByIdProps) {
  const { modules, dashboardFilters, isInitialLoading, isFetchingMore, hasMoreError, hasMore, loadMore, retry } =
    useInfiniteModulesById(dashboardId);

  if (isInitialLoading) {
    return (
      <div className={styles.skeletonGrid} role="status" aria-label="Loading dashboard modules">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    );
  }

  if (modules.length === 0) {
    return <div className={styles.emptyState}>No modules are configured on this dashboard yet.</div>;
  }

  return (
    <>
      <DashboardGrid modules={modules} dashboardFilters={dashboardFilters} />

      <div className={styles.footer}>
        {isFetchingMore && (
          <div className={styles.loadingMore}>
            <span className={styles.spinner} />
            Loading more...
          </div>
        )}
        {hasMoreError && (
          <div className={styles.errorFooter}>
            <span>Unable to load more modules.</span>
            <button type="button" className={styles.retryButton} onClick={retry}>
              Retry
            </button>
          </div>
        )}
        {!hasMore && !isFetchingMore && !hasMoreError && <span className={styles.doneLabel}>All modules loaded.</span>}
      </div>

      <LoadMoreSentinel onIntersect={loadMore} disabled={!hasMore || hasMoreError} refreshKey={modules.length} />
    </>
  );
}
