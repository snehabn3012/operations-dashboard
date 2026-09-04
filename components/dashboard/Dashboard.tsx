"use client";

import AppShell from "@/components/layout/AppShell";
import ModuleLoader from "@/components/dashboard/ModuleLoader";
import { getRoleLabel } from "@/config/roles";
import { useAppSelector } from "@/store/hooks";

export default function Dashboard() {
  const selectedRole = useAppSelector((state) => state.dashboardUi.selectedRole);

  return (
    <AppShell title={`${getRoleLabel(selectedRole)} Dashboard`}>
      <ModuleLoader role={selectedRole} key={selectedRole} />
    </AppShell>
  );
}
