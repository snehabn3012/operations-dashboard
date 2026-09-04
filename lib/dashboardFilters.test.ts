import { describe, expect, it } from "vitest";

import { resolveEffectiveWidgetConfig } from "@/lib/dashboardFilters";
import { DashboardFilterConfig, WidgetConfig } from "@/types/dashboard";

const WIDGET: WidgetConfig = {
  id: "w1",
  title: "Transactions",
  dataSource: "transactions",
  widgetType: "table",
  visible: true,
  order: 1,
  layout: { width: 6, height: 2 },
  filter: { value: "all", label: "All Time" },
};

describe("resolveEffectiveWidgetConfig", () => {
  it("returns the widget unchanged when no dashboard filter applies to it", () => {
    const result = resolveEffectiveWidgetConfig(WIDGET, []);
    expect(result).toBe(WIDGET);
  });

  it("overrides the widget's own filter when it's in an applicable dashboard filter's scope", () => {
    const dashboardFilter: DashboardFilterConfig = {
      id: "df1",
      dataSource: "transactions",
      filter: { value: "last30", label: "Last 30 Days" },
      appliesToWidgetIds: ["w1"],
    };

    const result = resolveEffectiveWidgetConfig(WIDGET, [dashboardFilter]);

    expect(result.filter).toEqual({ value: "last30", label: "Last 30 Days" });
    expect(WIDGET.filter).toEqual({ value: "all", label: "All Time" }); // the widget's own saved filter is untouched
  });

  it("does not apply a dashboard filter for a different data source, even if the widget id happens to be listed", () => {
    const dashboardFilter: DashboardFilterConfig = {
      id: "df1",
      dataSource: "orders", // widget's dataSource is "transactions"
      filter: { value: "processing", label: "Processing" },
      appliesToWidgetIds: ["w1"],
    };

    const result = resolveEffectiveWidgetConfig(WIDGET, [dashboardFilter]);

    expect(result).toBe(WIDGET);
  });

  it("does not apply a dashboard filter the widget isn't explicitly scoped into, even on a matching data source", () => {
    const dashboardFilter: DashboardFilterConfig = {
      id: "df1",
      dataSource: "transactions",
      filter: { value: "last30", label: "Last 30 Days" },
      appliesToWidgetIds: ["some-other-widget"],
    };

    const result = resolveEffectiveWidgetConfig(WIDGET, [dashboardFilter]);

    expect(result).toBe(WIDGET);
  });
});
