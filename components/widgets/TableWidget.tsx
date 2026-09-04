import { formatCellValue, MAX_VISIBLE_ROWS } from "@/lib/format";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./TableWidget.module.css";

/** Resolves which columns to render, and in what order: the widget's configured field selection when set (skipping any field that no longer exists on this data source), otherwise every column -- the pre-existing behavior. */
function resolveColumns(columns: WidgetContentProps["data"]["columns"], fields: string[] | undefined) {
  if (!fields || fields.length === 0) return columns;
  const selected = fields.map((key) => columns.find((c) => c.key === key)).filter((c): c is (typeof columns)[number] => Boolean(c));
  return selected.length > 0 ? selected : columns;
}

export default function TableWidget({ config, data }: WidgetContentProps) {
  const rows = data.rows.slice(0, MAX_VISIBLE_ROWS);
  const columns = resolveColumns(data.columns, config.fields);
  const hiddenCount = data.rows.length - rows.length;

  return (
    <div className={styles.tableWrap}>
      <div className={styles.scrollArea}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.key} data-key={col.key}>
                    {formatCellValue(col.key, row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className={styles.truncationNotice}>
          Showing {rows.length} of {data.rows.length} rows · {hiddenCount} more not shown
        </div>
      )}
    </div>
  );
}
