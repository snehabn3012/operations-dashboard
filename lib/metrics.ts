import { DataSourceResult, MetricType } from "@/types/dashboard";

/** Reduces a DataSourceResult (rows and/or a time series) to a single number for KPI widgets. */
export function computeMetricValue(data: DataSourceResult, metric: MetricType = "count"): number {
  const { rows, series, valueField } = data;

  switch (metric) {
    case "sum": {
      if (rows.length > 0) return rows.reduce((sum, row) => sum + (Number(row[valueField]) || 0), 0);
      return series.reduce((sum, point) => sum + point.value, 0);
    }
    case "average": {
      if (rows.length > 0) {
        const total = rows.reduce((sum, row) => sum + (Number(row[valueField]) || 0), 0);
        return total / rows.length;
      }
      if (series.length === 0) return 0;
      return series.reduce((sum, point) => sum + point.value, 0) / series.length;
    }
    case "latest": {
      if (series.length > 0) return series[series.length - 1].value;
      if (rows.length > 0) return Number(rows[0][valueField]) || 0;
      return 0;
    }
    case "count":
    default:
      return rows.length > 0 ? rows.length : series.length;
  }
}

export function isMonetaryMetric(metric: MetricType | undefined): boolean {
  return metric === "sum" || metric === "average" || metric === "latest";
}
