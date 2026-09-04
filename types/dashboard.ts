export type Role =
  | "admin"
  | "operationsManager"
  | "financeManager"
  | "supportAgent"
  | "customer";

export type WidgetType = "kpi" | "barChart" | "lineChart" | "table" | "list";

export type DataSourceKey =
  | "customers"
  | "transactions"
  | "revenue"
  | "orders"
  | "payments";

export type MetricType = "count" | "sum" | "average" | "latest";

export interface FilterOption {
  value: string;
  label: string;
}

export interface SortOption {
  value: string;
  label: string;
  field: string;
  direction: "asc" | "desc";
}

export interface WidgetFilter {
  value: string;
  label: string;
}

export interface WidgetSort {
  value: string;
  label: string;
  field: string;
  direction: "asc" | "desc";
}

export interface WidgetLayout {
  width: number;
  height: number;
}

export interface WidgetConfig {
  id: string;
  title: string;
  dataSource: DataSourceKey;
  widgetType: WidgetType;
  visible: boolean;
  /** 1-based position on the canvas/dashboard grid. The single source of truth for render order -- kept in sync by the configure builder on every add/remove/reorder. */
  order: number;
  layout: WidgetLayout;
  filter?: WidgetFilter;
  sort?: WidgetSort;
  metric?: MetricType;
  /** Table/List only: which of the data source's columns to show, and in what order. Unset (or empty) means "all columns" -- the pre-existing behavior. Field keys that no longer exist on the data source are silently skipped, not shown as broken columns. */
  fields?: string[];
  /** Bar/Line charts only: bucket rows by this field's value instead of the default calendar-month bucketing. Unset means "group by month" -- the pre-existing behavior. See GROUP_BY_OPTIONS_BY_SOURCE for which fields are valid per data source. */
  groupBy?: string;
}

/**
 * A filter that applies to more than one widget at once, scoped explicitly by
 * widget id (not "every widget on this data source") -- the brief this was
 * built against requires the scope to be explicit in the configuration. A
 * widget named in `appliesToWidgetIds` has this filter override its own
 * `WidgetConfig.filter` at render time; its own saved filter is untouched and
 * takes effect again if the dashboard filter is removed or the widget is
 * unscoped from it.
 */
export interface DashboardFilterConfig {
  id: string;
  dataSource: DataSourceKey;
  filter: WidgetFilter;
  appliesToWidgetIds: string[];
}

export interface DashboardConfig {
  /** Stable identity for this dashboard, independent of role -- what makes it addressable via /dashboard/[id] and shareable. Assigned once, at creation, and preserved across every subsequent edit/reset/save of the same dashboard. */
  id: string;
  role: Role;
  version: number;
  widgets: WidgetConfig[];
  dashboardFilters: DashboardFilterConfig[];
  updatedAt: string;
  /** Edit generation, bumped by the server on every successful save. A save whose `revision` doesn't match the currently stored config's is a stale/conflicting edit (see updateDashboardConfig). */
  revision: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
  date?: string;
}

export interface DataRow {
  id: string;
  [key: string]: unknown;
}

export interface DataColumn {
  key: string;
  label: string;
}

export interface DataSourceResult {
  source: DataSourceKey;
  series: SeriesPoint[];
  rows: DataRow[];
  columns: DataColumn[];
  /** Row/series field that represents the primary numeric amount, used for sum/average/latest metrics. */
  valueField: string;
  generatedAt: string;
}

export interface DataSourceQueryArgs {
  filter?: WidgetFilter;
  sort?: WidgetSort;
  groupBy?: string;
}

export interface ModulesPage {
  modules: WidgetConfig[];
  /** So the dashboard grid can resolve each module's effective filter (a dashboard-level filter in scope overrides the module's own) without a second round-trip. */
  dashboardFilters: DashboardFilterConfig[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ModulesPageArgs {
  role: Role;
  page: number;
  limit: number;
}

export interface WidgetContentProps {
  config: WidgetConfig;
  data: DataSourceResult;
}

export const SIMULATE_ERROR_VALUE = "__simulate_error__";

/** Thrown/returned by updateDashboardConfig when the save's `revision` doesn't match what's currently stored -- someone else saved changes to this role's dashboard first. */
export const CONFIG_CONFLICT_ERROR = "CONFIG_CONFLICT";

/** Thrown/returned by the id-based dashboard lookups (getDashboardConfigById, getDashboardModulesById) when no dashboard with that id has ever been created. */
export const DASHBOARD_NOT_FOUND_ERROR = "DASHBOARD_NOT_FOUND";
