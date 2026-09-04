"use client";

import DashboardGrid from "@/components/dashboard/DashboardGrid";
import LoadMoreSentinel from "@/components/dashboard/LoadMoreSentinel";
import { useInfiniteModules } from "@/hooks/useInfiniteModules";
import { Role } from "@/types/dashboard";

import styles from "./ModuleLoader.module.css";

interface ModuleLoaderProps {
  role: Role;
}

/** Drives the dashboard's scroll-based pagination: loads page 1 automatically, then loads more as the sentinel comes into view. */
export default function ModuleLoader({ role }: ModuleLoaderProps) {
  const { modules, isInitialLoading, isFetchingMore, hasMoreError, hasMore, loadMore, retry } = useInfiniteModules(role);

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
    return <div className={styles.emptyState}>No modules are configured for this role yet.</div>;
  }

  return (
    <>
      <DashboardGrid modules={modules} />

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
