"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import WidgetRenderer from "@/components/dashboard/WidgetRenderer";
import { resolveEffectiveWidgetConfig } from "@/lib/dashboardFilters";
import { DashboardFilterConfig, WidgetConfig } from "@/types/dashboard";

import styles from "./CanvasWidgetCard.module.css";

interface CanvasWidgetCardProps {
  widget: WidgetConfig;
  dashboardFilters: DashboardFilterConfig[];
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * One widget on the builder canvas, rendered exactly as it appears on
 * /dashboard -- the same WidgetRenderer, no extra card/border/icons -- so
 * the canvas doubles as a true live preview. Click it to select it and open
 * its configuration in the side drawer (that drawer is also where it gets
 * removed now); drag it anywhere to reorder. A thin outline (not a border,
 * so it never shifts layout) marks the selected widget.
 */
export default function CanvasWidgetCard({ widget, dashboardFilters, isSelected, onSelect }: CanvasWidgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { type: "canvas-item" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragProps = {
    ...attributes,
    ...listeners,
    "aria-pressed": isSelected,
    "aria-label": `Configure ${widget.title}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="canvas-card"
      className={`${styles.wrapper} ${isDragging ? styles.dragging : ""} ${!widget.visible ? styles.hidden : ""} ${
        isSelected ? styles.selected : ""
      }`}
      onClick={() => onSelect(widget.id)}
      {...dragProps}
    >
      <WidgetRenderer config={resolveEffectiveWidgetConfig(widget, dashboardFilters)} />
    </div>
  );
}
