import { DataSourceKey, MetricType, WidgetFilter, WidgetLayout, WidgetSort, WidgetType } from "@/types/dashboard";

export interface WidgetTemplate {
  templateId: string;
  title: string;
  dataSource: DataSourceKey;
  widgetType: WidgetType;
  metric?: MetricType;
  filter?: WidgetFilter;
  sort?: WidgetSort;
  layout: WidgetLayout;
}

const NEWEST_FIRST: WidgetSort = { value: "newest", label: "Newest First", field: "date", direction: "desc" };

/**
 * The fixed set of widgets an Operations Lead can drag onto a role's
 * dashboard canvas. Each entry is a template, not a placed widget -- dropping
 * one onto the canvas (components/configuration/DashboardCanvas.tsx) stamps
 * out a fresh WidgetConfig with a newly generated id, so the same template
 * can be dropped multiple times.
 */
export const WIDGET_PALETTE: WidgetTemplate[] = [
  {
    templateId: "revenue",
    title: "Revenue",
    dataSource: "revenue",
    widgetType: "kpi",
    metric: "sum",
    filter: { value: "ytd", label: "Year to Date" },
    layout: { width: 3, height: 1 },
  },
  {
    templateId: "customers",
    title: "Customers",
    dataSource: "customers",
    widgetType: "table",
    sort: { value: "newest", label: "Newest First", field: "joinedDate", direction: "desc" },
    layout: { width: 6, height: 2 },
  },
  {
    templateId: "transactions",
    title: "Transactions",
    dataSource: "transactions",
    widgetType: "table",
    sort: NEWEST_FIRST,
    layout: { width: 6, height: 2 },
  },
  {
    templateId: "orders",
    title: "Orders",
    dataSource: "orders",
    widgetType: "table",
    sort: NEWEST_FIRST,
    layout: { width: 6, height: 2 },
  },
  {
    templateId: "payments",
    title: "Payments",
    dataSource: "payments",
    widgetType: "list",
    filter: { value: "all", label: "All Payments" },
    layout: { width: 4, height: 2 },
  },
  {
    templateId: "active-customers",
    title: "Active Customers",
    dataSource: "customers",
    widgetType: "kpi",
    metric: "count",
    filter: { value: "active", label: "Active Only" },
    layout: { width: 3, height: 1 },
  },
  {
    templateId: "revenue-trend",
    title: "Revenue Trend",
    dataSource: "revenue",
    widgetType: "lineChart",
    filter: { value: "last6", label: "Last 6 Months" },
    layout: { width: 6, height: 2 },
  },
  {
    templateId: "recent-transactions",
    title: "Recent Transactions",
    dataSource: "transactions",
    widgetType: "table",
    sort: NEWEST_FIRST,
    layout: { width: 6, height: 2 },
  },
];
