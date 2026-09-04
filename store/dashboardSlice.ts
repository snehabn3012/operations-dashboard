import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  DashboardConfig,
  DashboardFilterConfig,
  DataSourceKey,
  Role,
  WidgetConfig,
  WidgetFilter,
  WidgetLayout,
  WidgetSort,
  WidgetType,
} from "@/types/dashboard";

/** What undo/redo actually snapshots: everything the user edits on the draft other than server relationship metadata (role/version/revision/updatedAt). */
interface DraftSnapshot {
  widgets: WidgetConfig[];
  dashboardFilters: DashboardFilterConfig[];
}

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
   * `draftConfig.widgets` and `draftConfig.dashboardFilters` --
   * role/version/updatedAt/revision are server relationship metadata, not
   * user-editable content, so undo/redo never touches them. `past` is
   * oldest-first; `future` is most-recently-undone first. Cleared whenever
   * the draft's baseline changes out from under the user (a fresh load, a
   * role switch) rather than by their own edit.
   */
  past: DraftSnapshot[];
  future: DraftSnapshot[];
  /** Which widget's title is mid-edit, so consecutive keystrokes coalesce into one undo step instead of one per character. Cleared by any other action. */
  coalescingTitleWidgetId: string | null;
  /**
   * Bumped on every edit to `draftConfig.widgets` (including coalesced title
   * keystrokes and undo/redo). Lets a save-in-flight tell, when it resolves,
   * whether the user changed anything *after* it was dispatched -- see
   * saveDraftConfigSucceeded. Reset alongside history whenever the draft's
   * baseline is replaced wholesale.
   */
  editGeneration: number;
}

const initialState: DashboardUiState = {
  selectedRole: "admin",
  draftConfig: null,
  isDirty: false,
  past: [],
  future: [],
  coalescingTitleWidgetId: null,
  editGeneration: 0,
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

function snapshotDraft(draftConfig: DashboardConfig): DraftSnapshot {
  return JSON.parse(JSON.stringify({ widgets: draftConfig.widgets, dashboardFilters: draftConfig.dashboardFilters }));
}

/** Caps local undo/redo history so a very long editing session can't grow it unboundedly; oldest steps are dropped first. `future` needs no separate cap -- it can only grow by moving entries out of `past` via undo, so it's already bounded by this. */
export const MAX_HISTORY = 50;

function bumpEditGeneration(state: DashboardUiState) {
  state.editGeneration += 1;
}

/** Records an undo step for the change about to happen (widgets or dashboard filters), and invalidates any redo path (a fresh edit after an undo discards the old future, rather than branching). Call before mutating draftConfig.widgets/dashboardFilters. */
function pushHistory(state: DashboardUiState) {
  if (!state.draftConfig) return;
  state.past.push(snapshotDraft(state.draftConfig));
  if (state.past.length > MAX_HISTORY) {
    state.past.shift();
  }
  state.future = [];
  state.coalescingTitleWidgetId = null;
  bumpEditGeneration(state);
}

/** Called whenever the draft's baseline is replaced wholesale (fresh load, role switch) rather than edited -- old history wouldn't reliably apply against a different role's or revision's widgets. */
function clearHistory(state: DashboardUiState) {
  state.past = [];
  state.future = [];
  state.coalescingTitleWidgetId = null;
  state.editGeneration = 0;
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
    /**
     * Deliberately does not clear history: a bad save should still be
     * undoable (and re-saveable) locally.
     *
     * `dispatchedForRole`/`dispatchedAtGeneration` are captured by the caller
     * at the moment the save was dispatched, not when it resolves. If the
     * user made further edits (or switched roles) while this save was in
     * flight, a full overwrite here would silently discard that work the
     * instant the response arrives -- a real, empirically-reproduced bug.
     * Instead: only adopt the response wholesale if nothing changed since
     * dispatch; otherwise keep the local widgets and adopt only the
     * server-authoritative metadata (role/version/revision/updatedAt), which
     * is what lets the *next* save's revision check pass rather than
     * incorrectly conflicting with the save that just succeeded.
     */
    saveDraftConfigSucceeded(
      state,
      action: PayloadAction<{ result: DashboardConfig; dispatchedForRole: Role; dispatchedAtGeneration: number }>,
    ) {
      const { result, dispatchedForRole, dispatchedAtGeneration } = action.payload;
      if (!state.draftConfig || state.draftConfig.role !== dispatchedForRole) {
        return; // the draft has moved on to a different role since this was dispatched; this response is moot
      }
      if (state.editGeneration === dispatchedAtGeneration) {
        state.draftConfig = result;
        state.isDirty = false;
      } else {
        state.draftConfig.role = result.role;
        state.draftConfig.version = result.version;
        state.draftConfig.revision = result.revision;
        state.draftConfig.updatedAt = result.updatedAt;
        // isDirty stays true: there are still local edits this save never saw.
      }
      state.coalescingTitleWidgetId = null;
    },
    undo(state) {
      if (!state.draftConfig || state.past.length === 0) return;
      const previous = state.past.pop()!;
      state.future.push(snapshotDraft(state.draftConfig));
      state.draftConfig.widgets = previous.widgets;
      state.draftConfig.dashboardFilters = previous.dashboardFilters;
      state.isDirty = true;
      state.coalescingTitleWidgetId = null;
      bumpEditGeneration(state);
    },
    redo(state) {
      if (!state.draftConfig || state.future.length === 0) return;
      const next = state.future.pop()!;
      state.past.push(snapshotDraft(state.draftConfig));
      state.draftConfig.widgets = next.widgets;
      state.draftConfig.dashboardFilters = next.dashboardFilters;
      state.isDirty = true;
      state.coalescingTitleWidgetId = null;
      bumpEditGeneration(state);
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
        pushHistory(state); // also bumps editGeneration
        state.coalescingTitleWidgetId = action.payload.id;
      } else {
        bumpEditGeneration(state); // still a real edit, even though it coalesces into the same undo step
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
      widget.fields = undefined;
      widget.groupBy = undefined;
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
    /** Table/List: which columns to show, and in what order. Empty array means "all columns." */
    updateWidgetFields(state, action: PayloadAction<{ id: string; fields: string[] }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.fields = action.payload.fields;
      state.isDirty = true;
    },
    /** Bar/Line charts: bucket by this field instead of by calendar month. undefined restores the default month bucketing. */
    updateWidgetGroupBy(state, action: PayloadAction<{ id: string; groupBy: string | undefined }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      pushHistory(state);
      widget.groupBy = action.payload.groupBy;
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
    /** Adds a new dashboard-level filter, initially in scope for no widgets -- scope is set explicitly afterward via toggleDashboardFilterWidget, per the requirement that scope be explicit rather than implicit. */
    addDashboardFilter(state, action: PayloadAction<{ filter: DashboardFilterConfig }>) {
      if (!state.draftConfig) return;
      pushHistory(state);
      state.draftConfig.dashboardFilters.push(action.payload.filter);
      state.isDirty = true;
    },
    removeDashboardFilter(state, action: PayloadAction<{ id: string }>) {
      const filters = state.draftConfig?.dashboardFilters;
      if (!filters) return;
      const index = filters.findIndex((f) => f.id === action.payload.id);
      if (index === -1) return;
      pushHistory(state);
      filters.splice(index, 1);
      state.isDirty = true;
    },
    /** Toggles whether a specific placed widget is in scope for a dashboard-level filter -- this is the "explicit scope" the filter's appliesToWidgetIds list is built from. */
    toggleDashboardFilterWidget(state, action: PayloadAction<{ filterId: string; widgetId: string }>) {
      const filter = state.draftConfig?.dashboardFilters.find((f) => f.id === action.payload.filterId);
      if (!filter) return;
      pushHistory(state);
      const index = filter.appliesToWidgetIds.indexOf(action.payload.widgetId);
      if (index === -1) {
        filter.appliesToWidgetIds.push(action.payload.widgetId);
      } else {
        filter.appliesToWidgetIds.splice(index, 1);
      }
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
  updateWidgetFields,
  updateWidgetGroupBy,
  addWidget,
  removeWidget,
  reorderWidgets,
  addDashboardFilter,
  removeDashboardFilter,
  toggleDashboardFilterWidget,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
