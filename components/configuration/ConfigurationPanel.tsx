"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import DashboardFiltersPanel from "@/components/configuration/DashboardFiltersPanel";
import RoleSelector from "@/components/configuration/RoleSelector";
import { getDefaultConfigForRole } from "@/config/dashboardConfig";
import { WidgetTemplate } from "@/config/widgetPalette";
import {
  addWidget,
  loadDraftConfig,
  redo,
  reorderWidgets,
  resetDraftConfig,
  saveDraftConfigSucceeded,
  undo,
} from "@/store/dashboardSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useGetDashboardConfigQuery, useUpdateDashboardConfigMutation } from "@/store/api/dashboardApi";
import { CONFIG_CONFLICT_ERROR, WidgetConfig } from "@/types/dashboard";

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
  const canUndo = useAppSelector((state) => state.dashboardUi.past.length > 0);
  const canRedo = useAppSelector((state) => state.dashboardUi.future.length > 0);
  const editGeneration = useAppSelector((state) => state.dashboardUi.editGeneration);

  const { data: savedConfig, isLoading, isFetching, refetch: refetchConfig } = useGetDashboardConfigQuery(selectedRole);
  const [updateConfig, { isLoading: isSaving }] = useUpdateDashboardConfigMutation();
  const [justSaved, setJustSaved] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Adjusting state during render (rather than in an effect) avoids an extra
  // commit; each guard becomes false immediately after firing, so this
  // converges in one extra render rather than looping.
  const [trackedRole, setTrackedRole] = useState(selectedRole);
  if (selectedRole !== trackedRole) {
    setTrackedRole(selectedRole);
    if (selectedWidgetId !== null) setSelectedWidgetId(null);
    if (saveConflict) setSaveConflict(false);
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
  // Must check savedConfig.role, not just its presence: right after a role
  // switch, RTK Query briefly still returns the *previous* role's cached
  // data while the new role's request is in flight, and seeding from that
  // would lock the draft one role switch behind.
  useEffect(() => {
    if (!draftConfig && savedConfig && savedConfig.role === selectedRole) {
      dispatch(loadDraftConfig(savedConfig));
    }
  }, [draftConfig, savedConfig, selectedRole, dispatch]);

  const handleSave = async () => {
    if (!draftConfig) return;
    // Captured now, not read after the await: if the user edits the draft
    // (or switches roles) while this request is in flight, the reducer needs
    // to know what the draft looked like *at dispatch time* to tell whether
    // it's still safe to overwrite it wholesale when the response arrives.
    const dispatchedForRole = selectedRole;
    const dispatchedAtGeneration = editGeneration;
    const result = await updateConfig({ role: selectedRole, config: draftConfig });
    if ("error" in result) {
      if (result.error === CONFIG_CONFLICT_ERROR) setSaveConflict(true);
      return;
    }
    dispatch(saveDraftConfigSucceeded({ result: result.data, dispatchedForRole, dispatchedAtGeneration }));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  // The reset target is a fresh default config, but it's still an edit made on
  // top of whatever revision is currently loaded -- keep that revision so a
  // reset-then-save isn't mistaken for a conflict with itself.
  const handleReset = () => {
    dispatch(resetDraftConfig({ ...getDefaultConfigForRole(selectedRole), revision: draftConfig?.revision ?? 0 }));
  };

  const handleReloadLatest = async () => {
    const latest = await refetchConfig();
    if (latest.data) dispatch(loadDraftConfig(latest.data));
    setSaveConflict(false);
  };

  const handleCopyLink = async () => {
    if (!draftConfig) return;
    const url = `${window.location.origin}/dashboard/${draftConfig.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) -- the link
      // text itself is still visible and selectable either way, so this is a
      // silent no-op rather than an error state.
    }
  };

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) trigger undo/redo, except while
  // focus is in a text field or dropdown -- otherwise this would hijack a
  // browser's native undo inside the widget title input, or interfere with
  // interacting with a <select>.
  useEffect(() => {
    function isEditingField(el: Element | null): boolean {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || isEditingField(document.activeElement)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        dispatch(redo());
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

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
          {justSaved && !isDirty && (
            <span
              className={styles.savedBadge}
              title="Kept in memory for this browser tab -- not persisted to a server. Refreshing or closing this tab loses it."
            >
              Saved to this session ✓
            </span>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch(undo())}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch(redo())}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            Redo
          </button>
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

      {draftConfig && (
        <div className={styles.shareRow}>
          <span className={styles.shareLabel}>Shareable link:</span>
          <Link className={styles.shareLink} href={`/dashboard/${draftConfig.id}`}>{`/dashboard/${draftConfig.id}`}</Link>
          <button type="button" className={styles.copyButton} onClick={handleCopyLink}>
            {linkCopied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      )}

      {saveConflict && (
        <div className={styles.conflictBanner} role="alert">
          <span>
            This dashboard was changed by someone else since you loaded it. Your unsaved changes were not saved.
          </span>
          <button type="button" className={styles.button} onClick={handleReloadLatest}>
            Reload Latest
          </button>
        </div>
      )}

      {draftConfig && (
        <DashboardFiltersPanel dashboardFilters={draftConfig.dashboardFilters} widgets={draftConfig.widgets} />
      )}

      {/*
        DndContext (and the Available Widgets column inside it) render
        unconditionally -- the palette is static, role-independent data with
        nothing to load, so it must not disappear just because the *canvas*
        side is between roles. Only the canvas column itself waits on
        draftConfig; DndContext has to wrap the palette regardless since
        dnd-kit's useDraggable requires a DndContext ancestor.
      */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.layout}>
          <div className={styles.column}>
            <span className={styles.sectionTitle}>Available Widgets</span>
            <AvailableWidgetsPanel onAdd={(template) => handleAddFromPalette(template)} />
          </div>
          <div className={styles.column}>
            <span className={styles.sectionTitle}>Canvas</span>
            {!draftConfig || (isLoading && !isFetching) ? (
              <div className={styles.loading}>Loading configuration...</div>
            ) : (
              <DashboardCanvas
                widgets={draftConfig.widgets}
                dashboardFilters={draftConfig.dashboardFilters}
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={setSelectedWidgetId}
              />
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDrag?.type === "palette" && <div className={styles.dragOverlayCard}>{activeDrag.template.title}</div>}
          {activeDrag?.type === "canvas-item" && <div className={styles.dragOverlayCard}>{activeDrag.widget.title}</div>}
        </DragOverlay>
      </DndContext>

      {selectedWidget && <ConfigDrawer widget={selectedWidget} onClose={() => setSelectedWidgetId(null)} />}
    </div>
  );
}
