import { describe, expect, it } from "vitest";

import reducer, {
  addWidget,
  DashboardUiState,
  loadDraftConfig,
  removeWidget,
  reorderWidgets,
  resetDraftConfig,
  saveDraftConfigSucceeded,
  setSelectedRole,
  updateWidgetType,
  updateWidgetVisibility,
} from "@/store/dashboardSlice";
import { DashboardConfig, WidgetConfig } from "@/types/dashboard";

function makeWidget(overrides: Partial<WidgetConfig> & Pick<WidgetConfig, "id" | "order">): WidgetConfig {
  return {
    title: overrides.id,
    dataSource: "revenue",
    widgetType: "lineChart",
    visible: true,
    layout: { width: 6, height: 2 },
    ...overrides,
  };
}

function makeConfig(widgets: WidgetConfig[]): DashboardConfig {
  return { role: "financeManager", version: 1, widgets, updatedAt: "2026-01-01T00:00:00.000Z" };
}

const initialState: DashboardUiState = { selectedRole: "admin", draftConfig: null, isDirty: false };

describe("dashboardSlice: /configure builder flow", () => {
  it("seeds a clean, non-dirty draft when the saved config loads", () => {
    const config = makeConfig([makeWidget({ id: "revenue", order: 1 })]);

    const state = reducer(initialState, loadDraftConfig(config));

    expect(state.draftConfig).toEqual(config);
    expect(state.isDirty).toBe(false);
  });

  it("hiding and retyping a widget marks the draft dirty without touching other widgets", () => {
    const revenue = makeWidget({ id: "revenue", order: 1, widgetType: "lineChart" });
    const transactions = makeWidget({ id: "transactions", order: 2, widgetType: "table" });
    let state = reducer(initialState, loadDraftConfig(makeConfig([revenue, transactions])));

    state = reducer(state, updateWidgetVisibility({ id: "revenue", visible: false }));
    state = reducer(state, updateWidgetType({ id: "revenue", widgetType: "kpi" }));

    expect(state.isDirty).toBe(true);
    const updatedRevenue = state.draftConfig?.widgets.find((w) => w.id === "revenue");
    expect(updatedRevenue?.visible).toBe(false);
    expect(updatedRevenue?.widgetType).toBe("kpi");
    expect(state.draftConfig?.widgets.find((w) => w.id === "transactions")).toEqual(transactions);
  });

  it("dropping a widget from the palette inserts it at the target index and resyncs order for every widget", () => {
    const first = makeWidget({ id: "first", order: 1 });
    const second = makeWidget({ id: "second", order: 2 });
    let state = reducer(initialState, loadDraftConfig(makeConfig([first, second])));

    const dropped = makeWidget({ id: "dropped", order: 0 });
    state = reducer(state, addWidget({ widget: dropped, atIndex: 1 }));

    expect(state.draftConfig?.widgets.map((w) => w.id)).toEqual(["first", "dropped", "second"]);
    expect(state.draftConfig?.widgets.map((w) => w.order)).toEqual([1, 2, 3]);
    expect(state.isDirty).toBe(true);
  });

  it("removing a widget closes the order gap left behind", () => {
    const widgets = [
      makeWidget({ id: "a", order: 1 }),
      makeWidget({ id: "b", order: 2 }),
      makeWidget({ id: "c", order: 3 }),
    ];
    let state = reducer(initialState, loadDraftConfig(makeConfig(widgets)));

    state = reducer(state, removeWidget({ id: "b" }));

    expect(state.draftConfig?.widgets.map((w) => w.id)).toEqual(["a", "c"]);
    expect(state.draftConfig?.widgets.map((w) => w.order)).toEqual([1, 2]);
  });

  it("drag-to-reorder writes the new order back onto every widget", () => {
    const widgets = [
      makeWidget({ id: "a", order: 1 }),
      makeWidget({ id: "b", order: 2 }),
      makeWidget({ id: "c", order: 3 }),
    ];
    let state = reducer(initialState, loadDraftConfig(makeConfig(widgets)));

    state = reducer(state, reorderWidgets({ orderedIds: ["c", "a", "b"] }));

    expect(state.draftConfig?.widgets.map((w) => w.id)).toEqual(["c", "a", "b"]);
    expect(state.draftConfig?.widgets.map((w) => w.order)).toEqual([1, 2, 3]);
  });

  it("a successful save clears the dirty flag", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1 })])));
    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false }));
    expect(state.isDirty).toBe(true);

    const saved = { ...state.draftConfig!, updatedAt: "2026-01-02T00:00:00.000Z" };
    state = reducer(state, saveDraftConfigSucceeded(saved));

    expect(state.draftConfig).toEqual(saved);
    expect(state.isDirty).toBe(false);
  });

  it("reset restores the default config but leaves it pending save", () => {
    const edited = makeConfig([makeWidget({ id: "a", order: 1, visible: false })]);
    let state = reducer(initialState, loadDraftConfig(edited));

    const defaults = makeConfig([makeWidget({ id: "a", order: 1, visible: true })]);
    state = reducer(state, resetDraftConfig(defaults));

    expect(state.draftConfig).toEqual(defaults);
    expect(state.isDirty).toBe(true);
  });

  it("switching roles discards the in-progress draft", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1 })])));
    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false }));

    state = reducer(state, setSelectedRole("financeManager"));

    expect(state.selectedRole).toBe("financeManager");
    expect(state.draftConfig).toBeNull();
    expect(state.isDirty).toBe(false);
  });
});
