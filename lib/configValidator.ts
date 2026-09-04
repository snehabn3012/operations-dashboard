import { CURRENT_CONFIG_VERSION, getDefaultConfigForRole, MODULE_CATALOG } from "@/config/dashboardConfig";
import { DashboardConfig, DataSourceKey, Role, WidgetConfig, WidgetLayout } from "@/types/dashboard";

const VALID_DATA_SOURCES: DataSourceKey[] = ["customers", "transactions", "revenue", "orders", "payments"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeLayout(raw: unknown): WidgetLayout {
  if (!isRecord(raw)) return { width: 6, height: 2 };
  const width = clamp(Number(raw.width), 1, 12);
  const height = clamp(Number(raw.height), 1, 4);
  return { width, height };
}

let anonymousWidgetCounter = 0;

/**
 * Normalizes a single widget entry so the renderer never has to guard against
 * missing fields. Unknown widgetType/dataSource values are preserved (not
 * coerced) so downstream UI can surface an explicit "unsupported" state
 * instead of silently rendering the wrong thing.
 */
function normalizeWidget(raw: unknown): WidgetConfig | null {
  if (!isRecord(raw)) return null;

  const catalogMatch = typeof raw.id === "string" ? MODULE_CATALOG.find((m) => m.id === raw.id) : undefined;

  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `widget-${++anonymousWidgetCounter}`;
  const title = typeof raw.title === "string" && raw.title.length > 0 ? raw.title : catalogMatch?.title ?? "Untitled Module";
  const dataSource = (typeof raw.dataSource === "string" ? raw.dataSource : catalogMatch?.dataSource) as
    | DataSourceKey
    | undefined;
  const widgetType = typeof raw.widgetType === "string" ? raw.widgetType : catalogMatch?.widgetType ?? "kpi";
  const visible = typeof raw.visible === "boolean" ? raw.visible : true;
  const layout = normalizeLayout(raw.layout ?? catalogMatch?.layout);

  if (!dataSource) return null;

  const widget: WidgetConfig = {
    id,
    title,
    dataSource: dataSource as DataSourceKey,
    widgetType: widgetType as WidgetConfig["widgetType"],
    visible,
    order: 0, // placeholder -- validateDashboardConfig resyncs this once the final widget order is known
    layout,
  };

  if (isRecord(raw.filter) && typeof raw.filter.value === "string" && typeof raw.filter.label === "string") {
    widget.filter = { value: raw.filter.value, label: raw.filter.label };
  }
  if (
    isRecord(raw.sort) &&
    typeof raw.sort.value === "string" &&
    typeof raw.sort.label === "string" &&
    typeof raw.sort.field === "string"
  ) {
    widget.sort = {
      value: raw.sort.value,
      label: raw.sort.label,
      field: raw.sort.field,
      direction: raw.sort.direction === "asc" ? "asc" : "desc",
    };
  }
  if (typeof raw.metric === "string" && ["count", "sum", "average", "latest"].includes(raw.metric)) {
    widget.metric = raw.metric as WidgetConfig["metric"];
  }

  return widget;
}

/**
 * Validates and normalizes an arbitrary (possibly malformed, possibly from an
 * older schema version) configuration payload into a well-formed
 * DashboardConfig. Falls back to the role's default configuration when the
 * payload is unusable, rather than throwing.
 */
export function validateDashboardConfig(raw: unknown, role: Role): DashboardConfig {
  if (!isRecord(raw) || !Array.isArray(raw.widgets)) {
    return getDefaultConfigForRole(role);
  }

  // Sort by each entry's own `order` hint (falling back to array position)
  // before normalizing, so the final resync below produces a sequence that
  // still respects an incoming order even if some entries get dropped.
  const withHints = raw.widgets.map((item, index) => ({
    item,
    hint: isRecord(item) && Number.isFinite(Number(item.order)) ? Number(item.order) : index,
  }));
  withHints.sort((a, b) => a.hint - b.hint);

  const widgets = withHints
    .map(({ item }) => normalizeWidget(item))
    .filter((w): w is WidgetConfig => w !== null)
    .filter((w) => VALID_DATA_SOURCES.includes(w.dataSource));

  if (widgets.length === 0) {
    return getDefaultConfigForRole(role);
  }

  widgets.forEach((w, i) => {
    w.order = i + 1;
  });

  return {
    role,
    version: CURRENT_CONFIG_VERSION,
    widgets,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    revision: Number.isFinite(Number(raw.revision)) ? Number(raw.revision) : 0,
  };
}
