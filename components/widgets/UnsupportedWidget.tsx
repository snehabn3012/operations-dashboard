import { WidgetConfig } from "@/types/dashboard";

import styles from "./UnsupportedWidget.module.css";

export default function UnsupportedWidget({ config }: { config: WidgetConfig }) {
  return (
    <div className={styles.wrap}>
      <span>Unsupported widget</span>
      <span className={styles.detail}>widgetType: &ldquo;{config.widgetType}&rdquo;</span>
    </div>
  );
}
