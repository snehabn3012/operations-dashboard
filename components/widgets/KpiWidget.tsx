import { formatCount, formatCurrency } from "@/lib/format";
import { computeMetric, isMonetaryMetric } from "@/lib/metrics";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./KpiWidget.module.css";

const METRIC_LABEL: Record<string, string> = {
  count: "Total count",
  sum: "Sum",
  average: "Average",
  latest: "Latest",
};

export default function KpiWidget({ config, data }: WidgetContentProps) {
  const metric = config.metric ?? "count";
  const { value, invalidCount } = computeMetric(data, metric);
  const formatted = isMonetaryMetric(metric) ? formatCurrency(value) : formatCount(value);

  return (
    <div className={styles.kpi}>
      <div className={styles.value}>{formatted}</div>
      <div className={styles.caption}>
        {METRIC_LABEL[metric]}
        {config.filter ? ` · ${config.filter.label}` : ""}
      </div>
      {invalidCount > 0 && (
        <div className={styles.warning} role="alert">
          ⚠️ {invalidCount} of {data.rows.length} row{data.rows.length === 1 ? "" : "s"} had a non-numeric value and{" "}
          {invalidCount === 1 ? "was" : "were"} excluded from this {metric === "average" ? "average" : "total"} — the true
          value may be higher.
        </div>
      )}
    </div>
  );
}
