import { ComponentType } from "react";

import BarChartWidget from "@/components/widgets/BarChartWidget";
import KpiWidget from "@/components/widgets/KpiWidget";
import LineChartWidget from "@/components/widgets/LineChartWidget";
import ListWidget from "@/components/widgets/ListWidget";
import TableWidget from "@/components/widgets/TableWidget";
import { WidgetContentProps, WidgetType } from "@/types/dashboard";

/**
 * Maps a widgetType string straight to its presentation component. Adding a
 * new widget type means adding one entry here and nowhere else -- the
 * renderer never branches on widgetType itself.
 */
export const widgetRegistry: Record<WidgetType, ComponentType<WidgetContentProps>> = {
  kpi: KpiWidget,
  barChart: BarChartWidget,
  lineChart: LineChartWidget,
  table: TableWidget,
  list: ListWidget,
};
