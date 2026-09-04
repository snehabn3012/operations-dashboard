"use client";

import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";

import CanvasWidgetCard from "@/components/configuration/CanvasWidgetCard";
// Reuses the real dashboard's own grid CSS (column/row track sizing, span
// buckets) so the builder canvas lays widgets out pixel-for-pixel the same
// way /dashboard will -- one grid definition, not two that can drift apart.
import gridStyles from "@/components/dashboard/DashboardGrid.module.css";
import { clampHeightBucket, nearestWidthBucket } from "@/lib/layoutBuckets";
import { WidgetConfig } from "@/types/dashboard";

import styles from "./DashboardCanvas.module.css";

interface DashboardCanvasProps {
  widgets: WidgetConfig[];
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
}

/**
 * The drop target and, simultaneously, the live preview: every card here
 * renders through the same WidgetRenderer the real /dashboard page uses.
 * Always registers the "canvas-root" droppable (even when empty) so a
 * palette widget can be dropped onto blank canvas, not just onto an
 * existing card.
 */
export default function DashboardCanvas({ widgets, selectedWidgetId, onSelectWidget }: DashboardCanvasProps) {
  const ordered = [...widgets].sort((a, b) => a.order - b.order);
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-root", data: { type: "canvas" } });

  return (
    <div ref={setNodeRef} data-testid="canvas-root" className={`${styles.canvas} ${isOver ? styles.canvasOver : ""}`}>
      {ordered.length === 0 ? (
        <div className={styles.empty}>Drag a widget from Available Widgets to start building this dashboard.</div>
      ) : (
        <SortableContext items={ordered.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className={gridStyles.grid}>
            {ordered.map((widget) => (
              <div
                key={widget.id}
                className={`${gridStyles.item} ${gridStyles[`span-${nearestWidthBucket(widget.layout.width)}`]} ${
                  gridStyles[`row-${clampHeightBucket(widget.layout.height)}`]
                }`}
              >
                <CanvasWidgetCard widget={widget} isSelected={widget.id === selectedWidgetId} onSelect={onSelectWidget} />
              </div>
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
