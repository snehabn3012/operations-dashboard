import { DataSourceResult, MetricType } from "@/types/dashboard";

export interface MetricResult {
  value: number;
  /**
   * Rows where `valueField` couldn't be read as a finite number -- missing,
   * renamed, or drifted from numeric to text. These are excluded from
   * sum/average (and from `latest`'s picked row) rather than silently
   * counted as 0, which would understate the result with no indication
   * anything was wrong. 0 when there's nothing to flag.
   */
  invalidCount: number;
}

function readNumeric(row: DataSourceResult["rows"][number], valueField: string): number | null {
  const raw = row[valueField];
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Reduces a DataSourceResult (rows and/or a time series) to a single number for KPI widgets, plus how many rows had to be excluded because their value wasn't actually numeric. */
export function computeMetric(data: DataSourceResult, metric: MetricType = "count"): MetricResult {
  const { rows, series, valueField } = data;

  switch (metric) {
    case "sum": {
      if (rows.length > 0) {
        let value = 0;
        let invalidCount = 0;
        for (const row of rows) {
          const n = readNumeric(row, valueField);
          if (n === null) invalidCount += 1;
          else value += n;
        }
        return { value, invalidCount };
      }
      return { value: series.reduce((sum, point) => sum + point.value, 0), invalidCount: 0 };
    }
    case "average": {
      if (rows.length > 0) {
        let total = 0;
        let validCount = 0;
        let invalidCount = 0;
        for (const row of rows) {
          const n = readNumeric(row, valueField);
          if (n === null) invalidCount += 1;
          else {
            total += n;
            validCount += 1;
          }
        }
        // Averaged over the rows that actually had a usable value, not over
        // every row -- an invalid row is excluded, not treated as a 0.
        return { value: validCount > 0 ? total / validCount : 0, invalidCount };
      }
      if (series.length === 0) return { value: 0, invalidCount: 0 };
      return { value: series.reduce((sum, point) => sum + point.value, 0) / series.length, invalidCount: 0 };
    }
    case "latest": {
      if (series.length > 0) return { value: series[series.length - 1].value, invalidCount: 0 };
      if (rows.length > 0) {
        const n = readNumeric(rows[0], valueField);
        return n === null ? { value: 0, invalidCount: 1 } : { value: n, invalidCount: 0 };
      }
      return { value: 0, invalidCount: 0 };
    }
    case "count":
    default:
      return { value: rows.length > 0 ? rows.length : series.length, invalidCount: 0 };
  }
}

export function isMonetaryMetric(metric: MetricType | undefined): boolean {
  return metric === "sum" || metric === "average" || metric === "latest";
}
