import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  DashboardConfig,
  DataSourceKey,
  Role,
  WidgetConfig,
  WidgetFilter,
  WidgetLayout,
  WidgetSort,
  WidgetType,
} from "@/types/dashboard";

/**
 * Client/UI state only. Server data (customers, transactions, revenue,
 * orders, payments, dashboard configuration, pagination) all lives in RTK
 * Query — see store/api/dashboardApi.ts. This slice tracks the role the user
 * is currently viewing/configuring plus the in-progress (possibly unsaved)
 * edits made on the /configure page. The draft doubles as "live preview"
 * state: the preview renders directly from `draftConfig`.
 */
export interface DashboardUiState {
  selectedRole: Role;
  draftConfig: DashboardConfig | null;
  isDirty: boolean;
  /**
   * Local undo/redo history for the current draft, as snapshots of
   * `draftConfig.widgets` only -- role/version/updatedAt/revision are server
   * relationship metadata, not user-editable content, so undo/redo never
   * touches them. `past` is oldest-first; `future` is most-recently-undone
   * first. Cleared whenever the draft's baseline changes out from under the
   * user (a fresh load, a role switch) rather than by their own edit.
   */
  past: WidgetConfig[][];
  future: WidgetConfig[][];
  /** Which widget's title is mid-edit, so consecutive keystrokes coalesce into one undo step instead of one per character. Cleared by any other action. */
  coalescingTitleWidgetId: string | null;
}

const initialState: DashboardUiState = {
  selectedRole: "admin",
  draftConfig: null,
  isDirty: false,
  past: [],
  future: [],
  coalescingTitleWidgetId: null,
};

function findWidget(state: DashboardUiState, id: string): WidgetConfig | undefined {
  return state.draftConfig?.widgets.find((w) => w.id === id);
}

/** Keeps each widget's `order` field in sync with its position in the array -- the single source of truth for canvas/dashboard placement. */
function resyncOrder(widgets: WidgetConfig[]) {
  widgets.forEach((w, i) => {
    w.order = i + 1;
  });
}

function snapshotWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
  return JSON.parse(JSON.stringify(widgets));
}

/** Records an undo step for the widget-content change about to happen, and invalidates any redo path (a fresh edit after an undo discards the old future, rather than branching). Call before mutating draftConfig.widgets. */
function pushHistory(state: DashboardUiState) {
  if (!state.draftConfig) return;
  state.past.push(snapshotWidgets(state.draftConfig.widgets));
  state.future = [];
  state.coalescingTitleWidgetId = null;
}

/** Called whenever the draft's baseline is replaced wholesale (fresh load, role switch) rather than edited -- old history wouldn't reliably apply against a different role's or revision's widgets. */
function clearHistory(state: DashboardUiState) {
  state.past = [];
  state.future = [];
  state.coalescingTitleWidgetId = null;
}

const dashboardSlice = createSlice({
  name: "dashboardUi",
  initialState,
  reducers: {
    setSelectedRole(state, action: PayloadAction<Role>) {
      state.selectedRole = action.payload;
      state.draftConfig = null;
      state.isDirty = false;
      clearHistory(state);
    },
    loadDraftConfig(state, action: PayloadAction<DashboardConfig>) {
      state.draftConfig = action.payload;
      state.isDirty = false;
      clearHistory(state);
    },
    /** Reset is itself an edit, and an undoable one -- accidentally clicking it is exactly the kind of "ruined edit" undo exists to recover from. */
    resetDraftConfig(state, action: PayloadAction<DashboardConfig>) {
      pushHistory(state);
      state.draftConfig = action.payload;
      state.isDirty = true;
    },
    /** Deliberately does not clear history: a bad save should still be undoable (and re-saveable) locally. */
    saveDraftConfigSucceeded(state, action: PayloadAction<DashboardConfig>) {
      state.draftConfig = action.payload;
      state.isDirty = false;
      state.coalescingTitleWidgetId = null;
    },
    undo(state) {
      if (!state.draftConfig || state.past.length === 0) return;
      const previous = state.past.pop()!;
      state.future.push(snapshotWidgets(state.draftConfig.widgets));
      state.draftConfig.widgets = previous;
      state.isDirty = true;
      state.coalescingTitleWidgetId = null;
    },
    redo(state) {
      if (!state.draftConfig || state.future.length === 0) return;
      const next = state.future.pop()!;
      state.past.push(snapshotWidgets(state.draftConfig.widgets));
      state.draftConfig.widgets = next;
      state.isDirty = true;
      state.coalescingTitleWidgetId = null;
    },
    updateWidgetVisibility(state, action: PayloadAction<{ id: string; visible: boolean }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.visible = action.payload.visible;
      state.isDirty = true;
    },
    /** Consecutive edits to the same widget's title coalesce into one undo step -- only pushes history when a *different* widget's title (or any other action) was last recorded. */
    updateWidgetTitle(state, action: PayloadAction<{ id: string; title: string }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      if (state.coalescingTitleWidgetId !== action.payload.id) {
        pushHistory(state);
        state.coalescingTitleWidgetId = action.payload.id;
      }
      widget.title = action.payload.title;
      state.isDirty = true;
    },
    updateWidgetType(state, action: PayloadAction<{ id: string; widgetType: WidgetType }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.widgetType = action.payload.widgetType;
      state.isDirty = true;
    },
    updateWidgetDataSource(state, action: PayloadAction<{ id: string; dataSource: DataSourceKey }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.dataSource = action.payload.dataSource;
      widget.filter = undefined;
      widget.sort = undefined;
      state.isDirty = true;
    },
    updateWidgetFilter(state, action: PayloadAction<{ id: string; filter: WidgetFilter | undefined }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.filter = action.payload.filter;
      state.isDirty = true;
    },
    updateWidgetSort(state, action: PayloadAction<{ id: string; sort: WidgetSort | undefined }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.sort = action.payload.sort;
      state.isDirty = true;
    },
    updateWidgetMetric(state, action: PayloadAction<{ id: string; metric: WidgetConfig["metric"] }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.metric = action.payload.metric;
      state.isDirty = true;
    },
    updateWidgetLayout(state, action: PayloadAction<{ id: string; layout: WidgetLayout }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.layout = action.payload.layout;
      state.isDirty = true;
    },
    /** Dropped from the Available Widgets palette onto the canvas -- inserted at a specific position (or appended when index is omitted). */
    addWidget(state, action: PayloadAction<{ widget: WidgetConfig; atIndex?: number }>) {
      const widgets = state.draftConfig?.widgets;
      if (!widgets) return;
      pushHistory(state);
      const index = action.payload.atIndex ?? widgets.length;
      widgets.splice(Math.max(0, Math.min(index, widgets.length)), 0, action.payload.widget);
      resyncOrder(widgets);
      state.isDirty = true;
    },
    /** Removed from the canvas via the card's ✕ button. Only removes this dashboard's config entry -- the Available Widgets palette is a static list, unaffected. */
    removeWidget(state, action: PayloadAction<{ id: string }>) {
      const widgets = state.draftConfig?.widgets;
      if (!widgets) return;
      const index = widgets.findIndex((w) => w.id === action.payload.id);
      if (index === -1) return;
      pushHistory(state);
      widgets.splice(index, 1);
      resyncOrder(widgets);
      state.isDirty = true;
    },
    /** Canvas drag-to-reorder: caller supplies the widget ids in their new order (e.g. via dnd-kit's arrayMove). */
    reorderWidgets(state, action: PayloadAction<{ orderedIds: string[] }>) {
      const widgets = state.draftConfig?.widgets;
      if (!widgets) return;
      const byId = new Map(widgets.map((w) => [w.id, w]));
      const reordered = action.payload.orderedIds.map((id) => byId.get(id)).filter((w): w is WidgetConfig => Boolean(w));
      if (reordered.length !== widgets.length) return;
      pushHistory(state);
      resyncOrder(reordered);
      state.draftConfig!.widgets = reordered;
      state.isDirty = true;
    },
  },
});

export const {
  setSelectedRole,
  loadDraftConfig,
  resetDraftConfig,
  saveDraftConfigSucceeded,
  undo,
  redo,
  updateWidgetVisibility,
  updateWidgetTitle,
  updateWidgetType,
  updateWidgetDataSource,
  updateWidgetFilter,
  updateWidgetSort,
  updateWidgetMetric,
  updateWidgetLayout,
  addWidget,
  removeWidget,
  reorderWidgets,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
