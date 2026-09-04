import { formatCellValue, MAX_VISIBLE_ROWS } from "@/lib/format";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./ListWidget.module.css";

export default function ListWidget({ config, data }: WidgetContentProps) {
  // Configured fields (if any) pick the primary display field and an
  // optional secondary/badge field, in order -- falling back to the
  // pre-existing heuristic (first non-id/value column; a column literally
  // named "status") when unset, or if a selected field no longer exists.
  const selectedFields = config.fields?.filter((key) => data.columns.some((c) => c.key === key));
  const primaryKey =
    selectedFields?.[0] ?? data.columns.find((c) => c.key !== "id" && c.key !== data.valueField)?.key ?? data.columns[0]?.key;
  const statusKey = selectedFields?.[1] ?? data.columns.find((c) => c.key === "status")?.key;
  const items = data.rows.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = data.rows.length - items.length;

  return (
    <div className={styles.listWrap}>
      <ul className={styles.list}>
        {items.map((row) => (
          <li key={row.id} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.itemTitle}>{formatCellValue(primaryKey ?? "id", row[primaryKey ?? "id"])}</span>
              {statusKey && (
                <span className={styles.badge} data-status={String(row[statusKey])}>
                  {String(row[statusKey])}
                </span>
              )}
            </div>
            <span className={styles.itemValue}>{formatCellValue(data.valueField, row[data.valueField])}</span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <div className={styles.truncationNotice}>
          Showing {items.length} of {data.rows.length} items · {hiddenCount} more not shown
        </div>
      )}
    </div>
  );
}
