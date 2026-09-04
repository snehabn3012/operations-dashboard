import { DataRow, SeriesPoint } from "@/types/dashboard";

/**
 * Caps how many distinct groups a group-by can render as separate bars/points.
 * A field with many more distinct values than this (the brief's own example:
 * "group by a field with 40,000 distinct values") does not get silently
 * truncated to the first N rows encountered -- every row is still counted,
 * the smallest groups are folded into one visible "+ N more" bucket instead
 * of being dropped, and the largest, most meaningful groups are kept.
 */
export const MAX_GROUPS = 8;

/**
 * Buckets `rows` by the string value of `field`, producing one series point
 * per group (count of rows, or sum of `valueField` when `metric === "sum"`).
 * Groups are sorted largest-first; anything beyond MAX_GROUPS is folded into
 * a single trailing "+ N more" point carrying the correct combined total,
 * rather than being dropped -- the total across all returned points (minus
 * that summary point, if you exclude it) still accounts for every row.
 */
export function groupRowsByField(
  rows: DataRow[],
  field: string,
  metric: "count" | "sum" = "count",
  valueField?: string,
): SeriesPoint[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const raw = row[field];
    const key = raw === undefined || raw === null || raw === "" ? "(none)" : String(raw);
    const amount = metric === "sum" && valueField ? Number(row[valueField]) || 0 : 1;
    buckets.set(key, (buckets.get(key) ?? 0) + amount);
  }

  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, MAX_GROUPS);
  const rest = sorted.slice(MAX_GROUPS);

  const points: SeriesPoint[] = top.map(([label, value]) => ({ label, value }));
  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, [, value]) => sum + value, 0);
    points.push({ label: `+ ${rest.length} more`, value: restTotal });
  }
  return points;
}
