import {
  DashboardConfig,
  DataSourceKey,
  FilterOption,
  Role,
  SortOption,
  WidgetConfig,
  WidgetFilter,
} from "@/types/dashboard";
import { SIMULATE_ERROR_VALUE } from "@/types/dashboard";

/** Bumped from 1 to 2 to demonstrate schema migration -- see migrateConfigV1ToV2 in lib/configValidator.ts for what changed. */
export const CURRENT_CONFIG_VERSION = 2;

/** Every module the application knows how to render, keyed by id. Roles select a subset. */
const MODULE_CATALOG_BASE: Omit<WidgetConfig, "order">[] = [
  {
    id: "active-customers",
    title: "Active Customers",
    dataSource: "customers",
    widgetType: "kpi",
    metric: "count",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "active", label: "Active Only" },
  },
  {
    id: "total-transactions",
    title: "Total Transactions",
    dataSource: "transactions",
    widgetType: "kpi",
    metric: "count",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "all", label: "All Time" },
  },
  {
    id: "monthly-transactions",
    title: "Monthly Transactions",
    dataSource: "transactions",
    widgetType: "barChart",
    visible: true,
    layout: { width: 6, height: 2 },
    filter: { value: "last90", label: "Last 90 Days" },
  },
  {
    id: "revenue",
    title: "Revenue",
    dataSource: "revenue",
    widgetType: "kpi",
    metric: "sum",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "ytd", label: "Year to Date" },
  },
  {
    id: "revenue-trend",
    title: "Revenue Trend",
    dataSource: "revenue",
    widgetType: "lineChart",
    visible: true,
    layout: { width: 6, height: 2 },
    filter: { value: "last6", label: "Last 6 Months" },
  },
  {
    id: "recent-transactions",
    title: "Recent Transactions",
    dataSource: "transactions",
    widgetType: "table",
    visible: true,
    layout: { width: 6, height: 2 },
    sort: { value: "newest", label: "Newest First", field: "date", direction: "desc" },
  },
  {
    id: "orders",
    title: "Orders",
    dataSource: "orders",
    widgetType: "table",
    visible: true,
    layout: { width: 6, height: 2 },
    sort: { value: "newest", label: "Newest First", field: "date", direction: "desc" },
  },
  {
    id: "payments",
    title: "Payments",
    dataSource: "payments",
    widgetType: "list",
    visible: true,
    layout: { width: 4, height: 2 },
    filter: { value: "all", label: "All Payments" },
  },
  {
    id: "new-customers",
    title: "New Customers",
    dataSource: "customers",
    widgetType: "kpi",
    metric: "count",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "new30", label: "New This Month" },
  },
  {
    id: "customer-growth",
    title: "Customer Growth",
    dataSource: "customers",
    widgetType: "lineChart",
    visible: true,
    layout: { width: 6, height: 2 },
    filter: { value: "all", label: "All Customers" },
  },
  {
    id: "top-customers",
    title: "Top Customers",
    dataSource: "customers",
    widgetType: "list",
    visible: true,
    layout: { width: 4, height: 2 },
    sort: { value: "spend", label: "Highest Spend", field: "totalSpent", direction: "desc" },
  },
  {
    id: "failed-transactions",
    title: "Failed Transactions",
    dataSource: "transactions",
    widgetType: "table",
    visible: true,
    layout: { width: 6, height: 2 },
    filter: { value: "failed", label: "Failed" },
    sort: { value: "newest", label: "Newest First", field: "date", direction: "desc" },
  },
  {
    id: "average-transaction-value",
    title: "Average Transaction Value",
    dataSource: "transactions",
    widgetType: "kpi",
    metric: "average",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "last30", label: "Last 30 Days" },
  },
  {
    id: "order-volume-trend",
    title: "Order Volume Trend",
    dataSource: "orders",
    widgetType: "barChart",
    visible: true,
    layout: { width: 6, height: 2 },
    filter: { value: "all", label: "All Orders" },
  },
  {
    id: "pending-orders",
    title: "Pending Orders",
    dataSource: "orders",
    widgetType: "list",
    visible: true,
    layout: { width: 4, height: 2 },
    filter: { value: "processing", label: "Processing" },
  },
  {
    id: "average-order-value",
    title: "Average Order Value",
    dataSource: "orders",
    widgetType: "kpi",
    metric: "average",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "all", label: "All Orders" },
  },
  {
    id: "successful-payments",
    title: "Successful Payments",
    dataSource: "payments",
    widgetType: "kpi",
    metric: "count",
    visible: true,
    layout: { width: 3, height: 1 },
    filter: { value: "successful", label: "Successful" },
  },
  {
    id: "failed-payments",
    title: "Failed Payments",
    dataSource: "payments",
    widgetType: "table",
    visible: true,
    layout: { width: 6, height: 2 },
    filter: { value: "failed", label: "Failed" },
    sort: { value: "newest", label: "Newest First", field: "date", direction: "desc" },
  },
];

export const MODULE_CATALOG: WidgetConfig[] = MODULE_CATALOG_BASE.map((widget, index) => ({
  ...widget,
  order: index + 1,
}));

const ROLE_MODULE_IDS: Record<Role, string[]> = {
  admin: MODULE_CATALOG.map((m) => m.id),
  operationsManager: [
    "active-customers",
    "total-transactions",
    "monthly-transactions",
    "recent-transactions",
    "orders",
  ],
  financeManager: ["revenue", "revenue-trend", "total-transactions", "recent-transactions", "payments"],
  supportAgent: ["active-customers", "orders", "recent-transactions"],
  customer: ["recent-transactions", "payments"],
};

/**
 * Roles whose entire view is scoped to their own activity get this filter
 * applied to every widget in their default config. A new self-scoped role is
 * a new entry here, not a new `if (role === ...)` branch -- see the
 * "Most Important Architectural Principle" this repo is built against
 * (a new role must not require touching this function's logic).
 */
const ROLE_SELF_SCOPED_FILTER: Partial<Record<Role, WidgetFilter>> = {
  customer: { value: "self", label: "My Activity" },
};

/** Per-role, per-widget title overrides (e.g. a self-scoped role sees "My Transactions" instead of "Recent Transactions"). */
const ROLE_WIDGET_TITLE_OVERRIDES: Partial<Record<Role, Record<string, string>>> = {
  customer: {
    "recent-transactions": "My Transactions",
    payments: "My Payments",
  },
};

export function getDefaultConfigForRole(role: Role): DashboardConfig {
  const ids = ROLE_MODULE_IDS[role] ?? [];
  const selfScopedFilter = ROLE_SELF_SCOPED_FILTER[role];
  const titleOverrides = ROLE_WIDGET_TITLE_OVERRIDES[role];

  const widgets = ids
    .map((id) => MODULE_CATALOG.find((m) => m.id === id))
    .filter((m): m is WidgetConfig => Boolean(m))
    .map((widget, index) => {
      const clone: WidgetConfig = JSON.parse(JSON.stringify(widget));
      clone.order = index + 1;
      if (titleOverrides?.[clone.id]) {
        clone.title = titleOverrides[clone.id];
      }
      if (selfScopedFilter) {
        clone.filter = selfScopedFilter;
      }
      return clone;
    });

  return {
    role,
    version: CURRENT_CONFIG_VERSION,
    widgets,
    updatedAt: new Date().toISOString(),
    revision: 0,
  };
}

export const FILTER_OPTIONS_BY_SOURCE: Record<DataSourceKey, FilterOption[]> = {
  customers: [
    { value: "all", label: "All Customers" },
    { value: "active", label: "Active Only" },
    { value: "new30", label: "New This Month" },
    { value: SIMULATE_ERROR_VALUE, label: "Simulate Error (Demo)" },
  ],
  transactions: [
    { value: "last7", label: "Last 7 Days" },
    { value: "last30", label: "Last 30 Days" },
    { value: "last90", label: "Last 90 Days" },
    { value: "all", label: "All Time" },
    { value: "completed", label: "Completed" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
    { value: "self", label: "My Activity" },
    { value: SIMULATE_ERROR_VALUE, label: "Simulate Error (Demo)" },
  ],
  revenue: [
    { value: "last3", label: "Last 3 Months" },
    { value: "last6", label: "Last 6 Months" },
    { value: "ytd", label: "Year to Date" },
    { value: SIMULATE_ERROR_VALUE, label: "Simulate Error (Demo)" },
  ],
  orders: [
    { value: "all", label: "All Orders" },
    { value: "processing", label: "Processing" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: SIMULATE_ERROR_VALUE, label: "Simulate Error (Demo)" },
  ],
  payments: [
    { value: "all", label: "All Payments" },
    { value: "successful", label: "Successful" },
    { value: "failed", label: "Failed" },
    { value: "self", label: "My Activity" },
    { value: SIMULATE_ERROR_VALUE, label: "Simulate Error (Demo)" },
  ],
};

export const SORT_OPTIONS_BY_SOURCE: Record<DataSourceKey, SortOption[]> = {
  customers: [
    { value: "name", label: "Name A-Z", field: "name", direction: "asc" },
    { value: "newest", label: "Newest First", field: "joinedDate", direction: "desc" },
    { value: "spend", label: "Highest Spend", field: "totalSpent", direction: "desc" },
  ],
  transactions: [
    { value: "newest", label: "Newest First", field: "date", direction: "desc" },
    { value: "oldest", label: "Oldest First", field: "date", direction: "asc" },
    { value: "amount", label: "Highest Amount", field: "amount", direction: "desc" },
  ],
  revenue: [
    { value: "newest", label: "Newest First", field: "month", direction: "desc" },
    { value: "oldest", label: "Oldest First", field: "month", direction: "asc" },
  ],
  orders: [
    { value: "newest", label: "Newest First", field: "date", direction: "desc" },
    { value: "oldest", label: "Oldest First", field: "date", direction: "asc" },
    { value: "total", label: "Highest Value", field: "total", direction: "desc" },
  ],
  payments: [
    { value: "newest", label: "Newest First", field: "date", direction: "desc" },
    { value: "amount", label: "Highest Amount", field: "amount", direction: "desc" },
  ],
};

export const WIDGET_TYPE_OPTIONS: { value: WidgetConfig["widgetType"]; label: string }[] = [
  { value: "kpi", label: "KPI / Number" },
  { value: "barChart", label: "Bar Chart" },
  { value: "lineChart", label: "Line Chart" },
  { value: "table", label: "Table" },
  { value: "list", label: "List" },
];

export const DATA_SOURCE_OPTIONS: { value: DataSourceKey; label: string }[] = [
  { value: "customers", label: "Customers" },
  { value: "transactions", label: "Transactions" },
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
];

export const METRIC_OPTIONS: { value: NonNullable<WidgetConfig["metric"]>; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "latest", label: "Latest" },
];
