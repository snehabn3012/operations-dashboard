import ConfigurationPanel from "@/components/configuration/ConfigurationPanel";
import AppShell from "@/components/layout/AppShell";

export default function ConfigurePage() {
  return (
    <AppShell title="Configure Dashboard">
      <ConfigurationPanel />
    </AppShell>
  );
}
