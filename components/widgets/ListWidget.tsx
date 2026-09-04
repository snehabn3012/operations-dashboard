import { formatCellValue } from "@/lib/format";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./ListWidget.module.css";

export default function ListWidget({ data }: WidgetContentProps) {
  const primaryKey = data.columns.find((c) => c.key !== "id" && c.key !== data.valueField)?.key ?? data.columns[0]?.key;
  const statusKey = data.columns.find((c) => c.key === "status")?.key;
  const items = data.rows.slice(0, 8);

  return (
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
  );
}
