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
}

const initialState: DashboardUiState = {
  selectedRole: "admin",
  draftConfig: null,
  isDirty: false,
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

const dashboardSlice = createSlice({
  name: "dashboardUi",
  initialState,
  reducers: {
    setSelectedRole(state, action: PayloadAction<Role>) {
      state.selectedRole = action.payload;
      state.draftConfig = null;
      state.isDirty = false;
    },
    loadDraftConfig(state, action: PayloadAction<DashboardConfig>) {
      state.draftConfig = action.payload;
      state.isDirty = false;
    },
    resetDraftConfig(state, action: PayloadAction<DashboardConfig>) {
      state.draftConfig = action.payload;
      state.isDirty = true;
    },
    saveDraftConfigSucceeded(state, action: PayloadAction<DashboardConfig>) {
      state.draftConfig = action.payload;
      state.isDirty = false;
    },
    updateWidgetVisibility(state, action: PayloadAction<{ id: string; visible: boolean }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.visible = action.payload.visible;
      state.isDirty = true;
    },
    updateWidgetTitle(state, action: PayloadAction<{ id: string; title: string }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.title = action.payload.title;
      state.isDirty = true;
    },
    updateWidgetType(state, action: PayloadAction<{ id: string; widgetType: WidgetType }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.widgetType = action.payload.widgetType;
      state.isDirty = true;
    },
    updateWidgetDataSource(state, action: PayloadAction<{ id: string; dataSource: DataSourceKey }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.dataSource = action.payload.dataSource;
      widget.filter = undefined;
      widget.sort = undefined;
      state.isDirty = true;
    },
    updateWidgetFilter(state, action: PayloadAction<{ id: string; filter: WidgetFilter | undefined }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.filter = action.payload.filter;
      state.isDirty = true;
    },
    updateWidgetSort(state, action: PayloadAction<{ id: string; sort: WidgetSort | undefined }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.sort = action.payload.sort;
      state.isDirty = true;
    },
    updateWidgetMetric(state, action: PayloadAction<{ id: string; metric: WidgetConfig["metric"] }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.metric = action.payload.metric;
      state.isDirty = true;
    },
    updateWidgetLayout(state, action: PayloadAction<{ id: string; layout: WidgetLayout }>) {
      const widget = findWidget(state, action.payload.id);
      if (!widget) return;
      widget.layout = action.payload.layout;
      state.isDirty = true;
    },
    /** Dropped from the Available Widgets palette onto the canvas -- inserted at a specific position (or appended when index is omitted). */
    addWidget(state, action: PayloadAction<{ widget: WidgetConfig; atIndex?: number }>) {
      const widgets = state.draftConfig?.widgets;
      if (!widgets) return;
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
