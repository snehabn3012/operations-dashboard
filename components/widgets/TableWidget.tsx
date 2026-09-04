import { formatCellValue } from "@/lib/format";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./TableWidget.module.css";

export default function TableWidget({ data }: WidgetContentProps) {
  const rows = data.rows.slice(0, 8);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {data.columns.map((col) => (
                <td key={col.key} data-key={col.key}>
                  {formatCellValue(col.key, row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
