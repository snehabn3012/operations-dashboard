import { formatCount, formatCurrency } from "@/lib/format";
import { computeMetricValue, isMonetaryMetric } from "@/lib/metrics";
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
  const value = computeMetricValue(data, metric);
  const formatted = isMonetaryMetric(metric) ? formatCurrency(value) : formatCount(value);

  return (
    <div className={styles.kpi}>
      <div className={styles.value}>{formatted}</div>
      <div className={styles.caption}>
        {METRIC_LABEL[metric]}
        {config.filter ? ` · ${config.filter.label}` : ""}
      </div>
    </div>
  );
}
