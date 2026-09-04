"use client";

import ModuleLoaderById from "@/components/dashboard/ModuleLoaderById";
import AppShell from "@/components/layout/AppShell";
import { getRoleLabel } from "@/config/roles";
import { useGetDashboardConfigByIdQuery } from "@/store/api/dashboardApi";

import styles from "./DashboardById.module.css";

interface DashboardByIdProps {
  id: string;
}

/**
 * The shareable /dashboard/[id] view: resolves a dashboard by its own stable
 * identity rather than by "the currently selected role," so a link copied
 * and sent to someone else opens the same dashboard regardless of what role
 * their own session happens to have selected.
 */
export default function DashboardById({ id }: DashboardByIdProps) {
  const { data: config, isLoading, isError } = useGetDashboardConfigByIdQuery(id);

  if (isError) {
    return (
      <AppShell title="Dashboard not found">
        <div className={styles.notFound}>
          <span className={styles.notFoundTitle}>Dashboard not found</span>
          This link doesn&apos;t point to a dashboard that exists. It may never have been created, or the id in the URL is wrong.
        </div>
      </AppShell>
    );
  }

  const title = config ? `${getRoleLabel(config.role)} Dashboard` : isLoading ? "Loading..." : "Dashboard";

  return (
    <AppShell title={title}>
      <ModuleLoaderById dashboardId={id} key={id} />
    </AppShell>
  );
}
