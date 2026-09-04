"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import AvailableWidgetsPanel from "@/components/configuration/AvailableWidgetsPanel";
import ConfigDrawer from "@/components/configuration/ConfigDrawer";
import DashboardCanvas from "@/components/configuration/DashboardCanvas";
import RoleSelector from "@/components/configuration/RoleSelector";
import { getDefaultConfigForRole } from "@/config/dashboardConfig";
import { WidgetTemplate } from "@/config/widgetPalette";
import { addWidget, loadDraftConfig, reorderWidgets, resetDraftConfig, saveDraftConfigSucceeded } from "@/store/dashboardSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useGetDashboardConfigQuery, useUpdateDashboardConfigMutation } from "@/store/api/dashboardApi";
import { WidgetConfig } from "@/types/dashboard";

import styles from "./ConfigurationPanel.module.css";

type ActiveDrag = { type: "palette"; template: WidgetTemplate } | { type: "canvas-item"; widget: WidgetConfig } | null;

function widgetFromTemplate(template: WidgetTemplate): WidgetConfig {
  return {
    id: crypto.randomUUID(),
    title: template.title,
    dataSource: template.dataSource,
    widgetType: template.widgetType,
    metric: template.metric,
    filter: template.filter,
    sort: template.sort,
    visible: true,
    order: 0, // resynced by the addWidget reducer once its position is known
    layout: { ...template.layout },
  };
}

export default function ConfigurationPanel() {
  const dispatch = useAppDispatch();
  const selectedRole = useAppSelector((state) => state.dashboardUi.selectedRole);
  const draftConfig = useAppSelector((state) => state.dashboardUi.draftConfig);
  const isDirty = useAppSelector((state) => state.dashboardUi.isDirty);

  const { data: savedConfig, isLoading, isFetching } = useGetDashboardConfigQuery(selectedRole);
  const [updateConfig, { isLoading: isSaving }] = useUpdateDashboardConfigMutation();
  const [justSaved, setJustSaved] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Adjusting state during render (rather than in an effect) avoids an extra
  // commit; each guard becomes false immediately after firing, so this
  // converges in one extra render rather than looping.
  const [trackedRole, setTrackedRole] = useState(selectedRole);
  if (selectedRole !== trackedRole) {
    setTrackedRole(selectedRole);
    if (selectedWidgetId !== null) setSelectedWidgetId(null);
  }
  if (selectedWidgetId && draftConfig && !draftConfig.widgets.some((w) => w.id === selectedWidgetId)) {
    setSelectedWidgetId(null);
  }

  const selectedWidget = draftConfig?.widgets.find((w) => w.id === selectedWidgetId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Seed the editable draft from the server the first time this role's
  // config becomes available. Once a draft exists we never silently
  // overwrite it with a background refetch -- only Save/Reset/role-change do.
  useEffect(() => {
    if (!draftConfig && savedConfig) {
      dispatch(loadDraftConfig(savedConfig));
    }
  }, [draftConfig, savedConfig, dispatch]);

  const handleSave = async () => {
    if (!draftConfig) return;
    try {
      const result = await updateConfig({ role: selectedRole, config: draftConfig }).unwrap();
      dispatch(saveDraftConfigSucceeded(result));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch {
      // updateConfig's rejected state is surfaced via isSaving/isError below if needed
    }
  };

  const handleReset = () => {
    dispatch(resetDraftConfig(getDefaultConfigForRole(selectedRole)));
  };

  const handleAddFromPalette = (template: WidgetTemplate, atIndex?: number) => {
    dispatch(addWidget({ widget: widgetFromTemplate(template), atIndex }));
  };

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { type?: string; template?: WidgetTemplate } | undefined;
    if (data?.type === "palette" && data.template) {
      setActiveDrag({ type: "palette", template: data.template });
    } else if (data?.type === "canvas-item") {
      const widget = draftConfig?.widgets.find((w) => w.id === event.active.id);
      if (widget) setActiveDrag({ type: "canvas-item", widget });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over || !draftConfig) return;

    const activeData = active.data.current as { type?: string; template?: WidgetTemplate } | undefined;
    const overData = over.data.current as { type?: string } | undefined;

    if (activeData?.type === "palette" && activeData.template) {
      const ordered = [...draftConfig.widgets].sort((a, b) => a.order - b.order);
      const atIndex = overData?.type === "canvas-item" ? ordered.findIndex((w) => w.id === over.id) : ordered.length;
      handleAddFromPalette(activeData.template, atIndex === -1 ? ordered.length : atIndex);
      return;
    }

    if (activeData?.type === "canvas-item") {
      if (active.id === over.id) return;
      const ids = [...draftConfig.widgets].sort((a, b) => a.order - b.order).map((w) => w.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      dispatch(reorderWidgets({ orderedIds: arrayMove(ids, oldIndex, newIndex) }));
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <RoleSelector />
        <div className={styles.actions}>
          {isDirty && <span className={styles.dirtyBadge}>Unsaved changes</span>}
          {justSaved && !isDirty && <span className={styles.savedBadge}>Saved ✓</span>}
          <button type="button" className={styles.button} onClick={handleReset} disabled={!draftConfig}>
            Reset
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={!draftConfig || !isDirty || isSaving}
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {!draftConfig || (isLoading && !isFetching) ? (
        <div className={styles.loading}>Loading configuration...</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={styles.layout}>
            <div className={styles.column}>
              <span className={styles.sectionTitle}>Available Widgets</span>
              <AvailableWidgetsPanel onAdd={(template) => handleAddFromPalette(template)} />
            </div>
            <div className={styles.column}>
              <span className={styles.sectionTitle}>Canvas</span>
              <DashboardCanvas
                widgets={draftConfig.widgets}
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={setSelectedWidgetId}
              />
            </div>
          </div>

          <DragOverlay>
            {activeDrag?.type === "palette" && <div className={styles.dragOverlayCard}>{activeDrag.template.title}</div>}
            {activeDrag?.type === "canvas-item" && <div className={styles.dragOverlayCard}>{activeDrag.widget.title}</div>}
          </DragOverlay>
        </DndContext>
      )}

      {selectedWidget && <ConfigDrawer widget={selectedWidget} onClose={() => setSelectedWidgetId(null)} />}
    </div>
  );
}
