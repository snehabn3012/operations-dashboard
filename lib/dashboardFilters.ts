import { DashboardFilterConfig, WidgetConfig } from "@/types/dashboard";

/**
 * A widget in a dashboard-level filter's explicit scope (appliesToWidgetIds)
 * has that filter override its own saved WidgetConfig.filter when rendering
 * -- the widget's own filter is untouched in the config and takes effect
 * again the moment it's unscoped or the dashboard filter is removed. Only
 * one dashboard filter can realistically apply per widget (a widget's
 * dataSource only has one filter slot at a time); if more than one somehow
 * names the same widget, the first match wins, deterministically.
 */
export function resolveEffectiveWidgetConfig(widget: WidgetConfig, dashboardFilters: DashboardFilterConfig[]): WidgetConfig {
  const applicable = dashboardFilters.find(
    (df) => df.dataSource === widget.dataSource && df.appliesToWidgetIds.includes(widget.id),
  );
  if (!applicable) return widget;
  return { ...widget, filter: applicable.filter };
}
