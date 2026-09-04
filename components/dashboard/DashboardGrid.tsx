import WidgetRenderer from "@/components/dashboard/WidgetRenderer";
import { clampHeightBucket, nearestWidthBucket } from "@/lib/layoutBuckets";
import { WidgetConfig } from "@/types/dashboard";

import styles from "./DashboardGrid.module.css";

function widthClass(width: number): string {
  return styles[`span-${nearestWidthBucket(width)}`];
}

function heightClass(height: number): string {
  return styles[`row-${clampHeightBucket(height)}`];
}

interface DashboardGridProps {
  modules: WidgetConfig[];
}

/** Renders whatever widgets it's given, purely from configuration -- position comes entirely from each widget's `order` field, size from its `layout` field. Nothing about placement is hardcoded here. */
export default function DashboardGrid({ modules }: DashboardGridProps) {
  const ordered = [...modules].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.grid}>
      {ordered.map((widget) => (
        <div key={widget.id} className={`${styles.item} ${widthClass(widget.layout.width)} ${heightClass(widget.layout.height)}`}>
          <WidgetRenderer config={widget} />
        </div>
      ))}
    </div>
  );
}
