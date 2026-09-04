"use client";

import { useDraggable } from "@dnd-kit/core";

import { WIDGET_PALETTE, WidgetTemplate } from "@/config/widgetPalette";
import { WidgetType } from "@/types/dashboard";

import styles from "./AvailableWidgetsPanel.module.css";

const WIDGET_TYPE_ICON: Record<WidgetType, string> = {
  kpi: "#",
  barChart: "▦",
  lineChart: "〰",
  table: "▤",
  list: "≡",
};

interface PaletteItemProps {
  template: WidgetTemplate;
  onAdd: (template: WidgetTemplate) => void;
}

function PaletteItem({ template, onAdd }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${template.templateId}`,
    data: { type: "palette", template },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="palette-item"
      className={`${styles.item} ${isDragging ? styles.dragging : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className={styles.icon} aria-hidden>
        {WIDGET_TYPE_ICON[template.widgetType]}
      </span>
      <span className={styles.itemBody}>
        <span className={styles.itemTitle}>{template.title}</span>
        <span className={styles.itemMeta}>{template.widgetType}</span>
      </span>
      <button
        type="button"
        className={styles.addButton}
        aria-label={`Add ${template.title} to dashboard`}
        onClick={(e) => {
          e.stopPropagation();
          onAdd(template);
        }}
      >
        +
      </button>
    </div>
  );
}

interface AvailableWidgetsPanelProps {
  onAdd: (template: WidgetTemplate) => void;
}

/** The palette side of the builder. Items are draggable onto the canvas; the "+" button is a keyboard-friendly equivalent that appends the widget to the end. */
export default function AvailableWidgetsPanel({ onAdd }: AvailableWidgetsPanelProps) {
  return (
    <div className={styles.panel}>
      <span className={styles.hint}>Drag onto the canvas, or press + to append</span>
      {WIDGET_PALETTE.map((template) => (
        <PaletteItem key={template.templateId} template={template} onAdd={onAdd} />
      ))}
    </div>
  );
}
