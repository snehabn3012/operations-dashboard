import { FIELD_OPTIONS_BY_SOURCE, getDefaultConfigForRole, GROUP_BY_OPTIONS_BY_SOURCE } from "@/config/dashboardConfig";
import { groupRowsByField } from "@/lib/grouping";
import { validateDashboardConfig } from "@/lib/configValidator";
import {
  CUSTOMERS,
  ORDERS,
  PAYMENTS,
  REVENUE,
  TRANSACTIONS,
  CustomerRecord,
  OrderRecord,
  PaymentRecord,
  TransactionRecord,
} from "@/data/mockData";
import {
  CONFIG_CONFLICT_ERROR,
  DASHBOARD_NOT_FOUND_ERROR,
  DashboardConfig,
  DataRow,
  DataSourceKey,
  DataSourceQueryArgs,
  DataSourceResult,
  ModulesPage,
  Role,
  SeriesPoint,
  SIMULATE_ERROR_VALUE,
  WidgetSort,
} from "@/types/dashboard";

function delay<T>(value: T, min = 350, max = 900): Promise<T> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function assertNotSimulatedError(filterValue: string | undefined, sourceLabel: string) {
  if (filterValue === SIMULATE_ERROR_VALUE) {
    throw new Error(`Simulated failure while loading ${sourceLabel} (demo error state).`);
  }
}

function withinDays(dateIso: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(dateIso).getTime() >= cutoff;
}

function sortRows(rows: DataRow[], sort?: WidgetSort): DataRow[] {
  if (!sort) return rows;
  const { field, direction } = sort;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return copy;
}

function monthlySeriesFromDates(dates: string[], months = 6): { label: string; value: number; date: string }[] {
  const buckets = new Map<string, { label: string; value: number; date: string }>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(key, { label: d.toLocaleString("en-US", { month: "short" }), value: 0, date: d.toISOString() });
  }
  for (const iso of dates) {
    const d = new Date(iso);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.value += 1;
  }
  return Array.from(buckets.values());
}

/**
 * A chart's series is either the default (rows bucketed by calendar month)
 * or, when the widget requests a valid categorical `groupBy` for this data
 * source, rows bucketed by that field instead (see lib/grouping.ts). An
 * unrecognized `groupBy` value -- e.g. left over after a data source
 * changed shape -- falls back to the month-based default rather than
 * erroring, consistent with how the rest of this layer treats drift.
 */
function computeSeries(source: DataSourceKey, rows: DataRow[], monthlyDates: string[], groupBy: string | undefined): SeriesPoint[] {
  const isValidGroupBy = groupBy ? GROUP_BY_OPTIONS_BY_SOURCE[source].some((f) => f.value === groupBy) : false;
  if (isValidGroupBy) return groupRowsByField(rows, groupBy!);
  return monthlySeriesFromDates(monthlyDates).map((p) => ({ label: p.label, value: p.value, date: p.date }));
}

const CURRENT_CUSTOMER_NAME = CUSTOMERS[0].name;

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function filterCustomers(filterValue: string | undefined): CustomerRecord[] {
  switch (filterValue) {
    case "active":
      return CUSTOMERS.filter((c) => c.status === "active");
    case "new30":
      return CUSTOMERS.filter((c) => withinDays(c.joinedDate, 30));
    case "self":
      return CUSTOMERS.filter((c) => c.name === CURRENT_CUSTOMER_NAME);
    default:
      return CUSTOMERS;
  }
}

export async function getCustomers(args: DataSourceQueryArgs = {}): Promise<DataSourceResult> {
  assertNotSimulatedError(args.filter?.value, "Customers");
  const filtered = filterCustomers(args.filter?.value);
  const rows: DataRow[] = filtered.map((c) => ({ ...c }));
  const sorted = sortRows(rows, args.sort);
  const series = computeSeries("customers", rows, filtered.map((c) => c.joinedDate), args.groupBy);
  return delay({
    source: "customers",
    series,
    rows: sorted,
    columns: FIELD_OPTIONS_BY_SOURCE.customers,
    valueField: "totalSpent",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

function filterTransactions(filterValue: string | undefined): TransactionRecord[] {
  switch (filterValue) {
    case "last7":
      return TRANSACTIONS.filter((t) => withinDays(t.date, 7));
    case "last30":
      return TRANSACTIONS.filter((t) => withinDays(t.date, 30));
    case "last90":
      return TRANSACTIONS.filter((t) => withinDays(t.date, 90));
    case "completed":
      return TRANSACTIONS.filter((t) => t.status === "completed");
    case "pending":
      return TRANSACTIONS.filter((t) => t.status === "pending");
    case "failed":
      return TRANSACTIONS.filter((t) => t.status === "failed");
    case "self":
      return TRANSACTIONS.filter((t) => t.customerName === CURRENT_CUSTOMER_NAME);
    default:
      return TRANSACTIONS;
  }
}

export async function getTransactions(args: DataSourceQueryArgs = {}): Promise<DataSourceResult> {
  assertNotSimulatedError(args.filter?.value, "Transactions");
  const filtered = filterTransactions(args.filter?.value);
  const rows: DataRow[] = filtered.map((t) => ({ ...t }));
  const sorted = sortRows(rows, args.sort ?? { value: "newest", label: "Newest First", field: "date", direction: "desc" });
  const series = computeSeries("transactions", rows, filtered.map((t) => t.date), args.groupBy);
  return delay({
    source: "transactions",
    series,
    rows: sorted,
    columns: FIELD_OPTIONS_BY_SOURCE.transactions,
    valueField: "amount",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

function filterRevenue(filterValue: string | undefined) {
  switch (filterValue) {
    case "last3":
      return REVENUE.slice(-3);
    case "last6":
      return REVENUE.slice(-6);
    case "ytd":
    default:
      return REVENUE;
  }
}

export async function getRevenue(args: DataSourceQueryArgs = {}): Promise<DataSourceResult> {
  assertNotSimulatedError(args.filter?.value, "Revenue");
  const points = filterRevenue(args.filter?.value);
  const series = points.map((p) => ({ label: p.label, value: p.value, date: p.month }));
  const rows: DataRow[] = points.map((p, i) => ({ id: `rev-${i}`, label: p.label, value: p.value }));
  return delay({
    source: "revenue",
    series,
    rows,
    columns: FIELD_OPTIONS_BY_SOURCE.revenue,
    valueField: "value",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function filterOrders(filterValue: string | undefined): OrderRecord[] {
  switch (filterValue) {
    case "processing":
      return ORDERS.filter((o) => o.status === "processing");
    case "delivered":
      return ORDERS.filter((o) => o.status === "delivered");
    case "cancelled":
      return ORDERS.filter((o) => o.status === "cancelled");
    case "self":
      return ORDERS.filter((o) => o.customerName === CURRENT_CUSTOMER_NAME);
    default:
      return ORDERS;
  }
}

export async function getOrders(args: DataSourceQueryArgs = {}): Promise<DataSourceResult> {
  assertNotSimulatedError(args.filter?.value, "Orders");
  const filtered = filterOrders(args.filter?.value);
  const rows: DataRow[] = filtered.map((o) => ({ ...o }));
  const sorted = sortRows(rows, args.sort ?? { value: "newest", label: "Newest First", field: "date", direction: "desc" });
  const series = computeSeries("orders", rows, filtered.map((o) => o.date), args.groupBy);
  return delay({
    source: "orders",
    series,
    rows: sorted,
    columns: FIELD_OPTIONS_BY_SOURCE.orders,
    valueField: "total",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function filterPayments(filterValue: string | undefined): PaymentRecord[] {
  switch (filterValue) {
    case "successful":
      return PAYMENTS.filter((p) => p.status === "successful");
    case "failed":
      return PAYMENTS.filter((p) => p.status === "failed");
    case "self":
      return PAYMENTS.filter((p) => p.customerName === CURRENT_CUSTOMER_NAME);
    default:
      return PAYMENTS;
  }
}

export async function getPayments(args: DataSourceQueryArgs = {}): Promise<DataSourceResult> {
  assertNotSimulatedError(args.filter?.value, "Payments");
  const filtered = filterPayments(args.filter?.value);
  const rows: DataRow[] = filtered.map((p) => ({ ...p }));
  const sorted = sortRows(rows, args.sort ?? { value: "newest", label: "Newest First", field: "date", direction: "desc" });
  const series = computeSeries("payments", rows, filtered.map((p) => p.date), args.groupBy);
  return delay({
    source: "payments",
    series,
    rows: sorted,
    columns: FIELD_OPTIONS_BY_SOURCE.payments,
    valueField: "amount",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Dashboard configuration (treated as server/application data)
// ---------------------------------------------------------------------------

/**
 * Backed by localStorage (not an in-memory Map) so a dashboard survives a
 * page reload and is visible from a new tab in the *same* browser -- without
 * this, "shareable link" only held for one continuous, never-reloaded
 * session (see DESIGN.md section 15). This is still not real persistence:
 * a different browser, profile, or device has its own localStorage and
 * won't see it, which needs an actual backend, not a bigger version of this.
 * Reads go straight to localStorage each time rather than keeping an
 * in-memory cache, so a write from another tab is picked up on the next
 * read without needing a `storage` event listener.
 */
const CONFIG_STORE_KEY = "opsdash:dashboards:v1";
const ROLE_POINTERS_KEY = "opsdash:role-dashboard-pointers:v1";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readStorageMap<T>(key: string): Map<string, T> {
  if (!hasLocalStorage()) return new Map();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, T>));
  } catch {
    // Malformed/corrupted storage (hand-edited, quota-truncated, from an
    // older schema) is treated as empty rather than thrown -- consistent
    // with how the rest of this layer treats bad input.
    return new Map();
  }
}

function writeStorageMap<T>(key: string, map: Map<string, T>) {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // Best-effort persistence for a prototype -- a full/blocked storage
    // shouldn't crash the save, it just won't survive a reload this time.
  }
}

function readConfig(role: Role): DashboardConfig {
  const pointers = readStorageMap<string>(ROLE_POINTERS_KEY);
  const existingId = pointers.get(role);
  const store = readStorageMap<DashboardConfig>(CONFIG_STORE_KEY);
  const existing = existingId ? store.get(existingId) : undefined;
  if (existing) return existing;

  const fresh = getDefaultConfigForRole(role);
  store.set(fresh.id, fresh);
  writeStorageMap(CONFIG_STORE_KEY, store);
  pointers.set(role, fresh.id);
  writeStorageMap(ROLE_POINTERS_KEY, pointers);
  return fresh;
}

function readConfigById(id: string): DashboardConfig | null {
  return readStorageMap<DashboardConfig>(CONFIG_STORE_KEY).get(id) ?? null;
}

export async function getDashboardConfig(role: Role): Promise<DashboardConfig> {
  return delay(readConfig(role), 250, 600);
}

/** For the shareable /dashboard/[id] route: resolves a dashboard directly by its stable identity, independent of whatever role is "currently selected" client-side. */
export async function getDashboardConfigById(id: string): Promise<DashboardConfig> {
  const found = readConfigById(id);
  if (!found) throw new Error(DASHBOARD_NOT_FOUND_ERROR);
  return delay(found, 250, 600);
}

/**
 * Optimistic concurrency check: the caller must be saving on top of the
 * revision they last loaded. If someone else's save landed first, the stored
 * revision has already moved on -- reject rather than silently clobbering
 * their change. The check and the store write below happen with no `await`
 * between them, so this is atomic with respect to other saves.
 *
 * Looks the current state up by the dashboard's own `id`, not by role --
 * `role` is only used as validateDashboardConfig's fallback target and to
 * keep the role's default-dashboard pointer current.
 */
export async function updateDashboardConfig(role: Role, config: DashboardConfig): Promise<DashboardConfig> {
  const current = readConfigById(config.id);
  if (current && config.revision !== current.revision) {
    throw new Error(CONFIG_CONFLICT_ERROR);
  }

  const validated = validateDashboardConfig(config, role);
  validated.id = config.id || crypto.randomUUID();
  validated.revision = (current?.revision ?? 0) + 1;
  validated.updatedAt = new Date().toISOString();

  const store = readStorageMap<DashboardConfig>(CONFIG_STORE_KEY);
  store.set(validated.id, validated);
  writeStorageMap(CONFIG_STORE_KEY, store);

  const pointers = readStorageMap<string>(ROLE_POINTERS_KEY);
  pointers.set(role, validated.id);
  writeStorageMap(ROLE_POINTERS_KEY, pointers);

  return delay(JSON.parse(JSON.stringify(validated)), 300, 700);
}

// ---------------------------------------------------------------------------
// Paginated dashboard modules (infinite scroll)
// ---------------------------------------------------------------------------

function paginateModules(config: DashboardConfig, page: number, limit: number): ModulesPage {
  const visible = config.widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);
  const total = visible.length;
  const start = (page - 1) * limit;
  const modules = visible.slice(start, start + limit);
  const hasMore = start + limit < total;
  return { modules, dashboardFilters: config.dashboardFilters, page, pageSize: limit, total, hasMore };
}

export async function getDashboardModules(role: Role, page: number, limit: number): Promise<ModulesPage> {
  const config = readConfig(role);
  return delay(paginateModules(config, page, limit), 400, 900);
}

/** Same pagination as getDashboardModules, but resolving the dashboard by its stable id -- what /dashboard/[id] uses. */
export async function getDashboardModulesById(dashboardId: string, page: number, limit: number): Promise<ModulesPage> {
  const config = readConfigById(dashboardId);
  if (!config) throw new Error(DASHBOARD_NOT_FOUND_ERROR);
  return delay(paginateModules(config, page, limit), 400, 900);
}
