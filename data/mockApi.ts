import { getDefaultConfigForRole } from "@/config/dashboardConfig";
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
  DashboardConfig,
  DataColumn,
  DataRow,
  DataSourceQueryArgs,
  DataSourceResult,
  ModulesPage,
  Role,
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

const CURRENT_CUSTOMER_NAME = CUSTOMERS[0].name;

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const CUSTOMER_COLUMNS: DataColumn[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "segment", label: "Segment" },
  { key: "totalSpent", label: "Total Spent" },
];

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
  const series = monthlySeriesFromDates(filtered.map((c) => c.joinedDate)).map((p) => ({
    label: p.label,
    value: p.value,
    date: p.date,
  }));
  return delay({
    source: "customers",
    series,
    rows: sorted,
    columns: CUSTOMER_COLUMNS,
    valueField: "totalSpent",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const TRANSACTION_COLUMNS: DataColumn[] = [
  { key: "id", label: "Transaction" },
  { key: "customerName", label: "Customer" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
];

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
  const series = monthlySeriesFromDates(filtered.map((t) => t.date));
  return delay({
    source: "transactions",
    series,
    rows: sorted,
    columns: TRANSACTION_COLUMNS,
    valueField: "amount",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

const REVENUE_COLUMNS: DataColumn[] = [
  { key: "label", label: "Month" },
  { key: "value", label: "Revenue" },
];

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
    columns: REVENUE_COLUMNS,
    valueField: "value",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const ORDER_COLUMNS: DataColumn[] = [
  { key: "id", label: "Order" },
  { key: "customerName", label: "Customer" },
  { key: "items", label: "Items" },
  { key: "total", label: "Total" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
];

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
  const series = monthlySeriesFromDates(filtered.map((o) => o.date));
  return delay({
    source: "orders",
    series,
    rows: sorted,
    columns: ORDER_COLUMNS,
    valueField: "total",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const PAYMENT_COLUMNS: DataColumn[] = [
  { key: "id", label: "Payment" },
  { key: "customerName", label: "Customer" },
  { key: "amount", label: "Amount" },
  { key: "method", label: "Method" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
];

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
  const series = monthlySeriesFromDates(filtered.map((p) => p.date));
  return delay({
    source: "payments",
    series,
    rows: sorted,
    columns: PAYMENT_COLUMNS,
    valueField: "amount",
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Dashboard configuration (treated as server/application data)
// ---------------------------------------------------------------------------

const configStore = new Map<Role, DashboardConfig>();

function readConfig(role: Role): DashboardConfig {
  const existing = configStore.get(role);
  if (existing) return JSON.parse(JSON.stringify(existing));
  const fresh = getDefaultConfigForRole(role);
  configStore.set(role, fresh);
  return JSON.parse(JSON.stringify(fresh));
}

export async function getDashboardConfig(role: Role): Promise<DashboardConfig> {
  return delay(readConfig(role), 250, 600);
}

/**
 * Optimistic concurrency check: the caller must be saving on top of the
 * revision they last loaded. If someone else's save landed first, the stored
 * revision has already moved on -- reject rather than silently clobbering
 * their change. The check and the store write below happen with no `await`
 * between them, so this is atomic with respect to other saves.
 */
export async function updateDashboardConfig(role: Role, config: DashboardConfig): Promise<DashboardConfig> {
  const current = readConfig(role);
  if (config.revision !== current.revision) {
    throw new Error(CONFIG_CONFLICT_ERROR);
  }

  const validated = validateDashboardConfig(config, role);
  validated.revision = current.revision + 1;
  validated.updatedAt = new Date().toISOString();
  configStore.set(role, validated);
  return delay(JSON.parse(JSON.stringify(validated)), 300, 700);
}

// ---------------------------------------------------------------------------
// Paginated dashboard modules (infinite scroll)
// ---------------------------------------------------------------------------

export async function getDashboardModules(role: Role, page: number, limit: number): Promise<ModulesPage> {
  const config = readConfig(role);
  const visible = config.widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);
  const total = visible.length;
  const start = (page - 1) * limit;
  const modules = visible.slice(start, start + limit);
  const hasMore = start + limit < total;

  return delay({ modules, page, pageSize: limit, total, hasMore }, 400, 900);
}
