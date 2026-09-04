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
}

export interface DashboardConfig {
  role: Role;
  version: number;
  widgets: WidgetConfig[];
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
}

export interface ModulesPage {
  modules: WidgetConfig[];
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
