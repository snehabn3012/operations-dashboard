import { describe, expect, it } from "vitest";

import reducer, {
  addWidget,
  DashboardUiState,
  loadDraftConfig,
  MAX_HISTORY,
  redo,
  removeWidget,
  reorderWidgets,
  resetDraftConfig,
  saveDraftConfigSucceeded,
  setSelectedRole,
  undo,
  updateWidgetTitle,
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
  return { role: "financeManager", version: 2, widgets, updatedAt: "2026-01-01T00:00:00.000Z", revision: 0 };
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
    state = reducer(
      state,
      saveDraftConfigSucceeded({ result: saved, dispatchedForRole: state.draftConfig!.role, dispatchedAtGeneration: state.editGeneration }),
    );

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

describe("dashboardSlice: undo/redo", () => {
  it("undo reverts the last edit and makes redo available; redo reapplies it", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, visible: true })])));
    expect(state.past).toEqual([]);

    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false }));
    expect(state.draftConfig?.widgets[0].visible).toBe(false);
    expect(state.past.length).toBe(1);
    expect(state.future).toEqual([]);

    state = reducer(state, undo());
    expect(state.draftConfig?.widgets[0].visible).toBe(true);
    expect(state.isDirty).toBe(true);
    expect(state.past.length).toBe(0);
    expect(state.future.length).toBe(1);

    state = reducer(state, redo());
    expect(state.draftConfig?.widgets[0].visible).toBe(false);
    expect(state.past.length).toBe(1);
    expect(state.future.length).toBe(0);
  });

  it("undo/redo are no-ops with nothing to undo/redo", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1 })])));
    const beforeUndo = state;
    state = reducer(state, undo());
    expect(state).toEqual(beforeUndo);

    state = reducer(state, redo());
    expect(state).toEqual(beforeUndo);
  });

  it("a new edit after undo discards the old redo path instead of branching", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, widgetType: "lineChart" })])));
    state = reducer(state, updateWidgetType({ id: "a", widgetType: "kpi" })); // edit 1
    state = reducer(state, undo()); // back to lineChart, "kpi" now sits in future
    expect(state.future.length).toBe(1);

    state = reducer(state, updateWidgetType({ id: "a", widgetType: "table" })); // a genuinely new edit

    expect(state.draftConfig?.widgets[0].widgetType).toBe("table");
    expect(state.future).toEqual([]); // the undone "kpi" is no longer reachable via redo
  });

  it("coalesces consecutive title edits on the same widget into a single undo step", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, title: "Orig" })])));

    state = reducer(state, updateWidgetTitle({ id: "a", title: "O" }));
    state = reducer(state, updateWidgetTitle({ id: "a", title: "Or" }));
    state = reducer(state, updateWidgetTitle({ id: "a", title: "Ord" }));
    expect(state.draftConfig?.widgets[0].title).toBe("Ord");
    expect(state.past.length).toBe(1); // one step for the whole typing burst, not one per keystroke

    state = reducer(state, undo());
    expect(state.draftConfig?.widgets[0].title).toBe("Orig"); // back to before typing started, in one undo
  });

  it("editing a different widget's title starts a new undo step rather than continuing to coalesce", () => {
    let state = reducer(
      initialState,
      loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, title: "A" }), makeWidget({ id: "b", order: 2, title: "B" })])),
    );

    state = reducer(state, updateWidgetTitle({ id: "a", title: "A2" }));
    state = reducer(state, updateWidgetTitle({ id: "b", title: "B2" }));

    expect(state.past.length).toBe(2);
  });

  it("Reset is itself undoable", () => {
    const edited = makeConfig([makeWidget({ id: "a", order: 1, visible: false })]);
    let state = reducer(initialState, loadDraftConfig(edited));

    const defaults = makeConfig([makeWidget({ id: "a", order: 1, visible: true })]);
    state = reducer(state, resetDraftConfig(defaults));
    expect(state.draftConfig?.widgets[0].visible).toBe(true);

    state = reducer(state, undo());
    expect(state.draftConfig?.widgets[0].visible).toBe(false); // the pre-reset draft is recovered
  });

  it("loading a fresh config (initial load, or role switch) clears history", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1 })])));
    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false }));
    expect(state.past.length).toBe(1);

    state = reducer(state, loadDraftConfig(makeConfig([makeWidget({ id: "b", order: 1 })])));
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);

    state = reducer(state, updateWidgetVisibility({ id: "b", visible: false }));
    state = reducer(state, setSelectedRole("supportAgent"));
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("a successful save keeps history, so a bad save is still locally undoable", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, visible: true })])));
    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false })); // the "bad" edit, now saved below
    expect(state.past.length).toBe(1);

    state = reducer(
      state,
      saveDraftConfigSucceeded({
        result: { ...state.draftConfig!, revision: 1 },
        dispatchedForRole: state.draftConfig!.role,
        dispatchedAtGeneration: state.editGeneration,
      }),
    );
    expect(state.past.length).toBe(1); // not cleared by save

    state = reducer(state, undo());
    expect(state.draftConfig?.widgets[0].visible).toBe(true); // recovered even after saving the bad edit
  });

  it("caps history at MAX_HISTORY steps, dropping the oldest first", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, visible: true })])));

    // Alternate visibility MAX_HISTORY + 10 times -- each toggle is its own
    // undo step (not a coalesced title edit), so this produces more history
    // entries than the cap allows.
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      state = reducer(state, updateWidgetVisibility({ id: "a", visible: i % 2 === 0 }));
    }

    expect(state.past.length).toBe(MAX_HISTORY);

    // Undoing MAX_HISTORY times empties `past`; there is no way back to the
    // very first (now-dropped) edits.
    for (let i = 0; i < MAX_HISTORY; i++) {
      state = reducer(state, undo());
    }
    expect(state.past.length).toBe(0);
    expect(state.future.length).toBe(MAX_HISTORY);
  });
});

describe("dashboardSlice: saveDraftConfigSucceeded does not clobber edits made while the save was in flight", () => {
  it("keeps a local edit made after dispatch, adopting only the server-authoritative metadata", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, visible: true })])));

    // The edit that's about to be saved.
    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false }));
    const dispatchedForRole = state.draftConfig!.role;
    const dispatchedAtGeneration = state.editGeneration; // captured "at dispatch time"

    // While that save is still in flight, the user makes ANOTHER edit.
    state = reducer(state, updateWidgetTitle({ id: "a", title: "Renamed mid-save" }));

    // The in-flight save now resolves. Its response reflects only the first
    // edit (visible: false) -- it has no idea the title changed afterward.
    const serverResponse = { ...state.draftConfig!, widgets: [{ ...state.draftConfig!.widgets[0], title: "a" }], revision: 1 };
    state = reducer(state, saveDraftConfigSucceeded({ result: serverResponse, dispatchedForRole, dispatchedAtGeneration }));

    // The mid-save title edit must survive -- this is the bug: a naive
    // overwrite would silently revert it to "a" here.
    expect(state.draftConfig?.widgets[0].title).toBe("Renamed mid-save");
    expect(state.isDirty).toBe(true); // there's still an edit that was never actually saved
    // But the server-authoritative revision *is* adopted, so the next save
    // attempt checks against the correct baseline instead of conflicting
    // with the save that just succeeded.
    expect(state.draftConfig?.revision).toBe(1);
  });

  it("adopts the response wholesale when nothing changed since dispatch", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1, visible: true })])));
    state = reducer(state, updateWidgetVisibility({ id: "a", visible: false }));
    const dispatchedForRole = state.draftConfig!.role;
    const dispatchedAtGeneration = state.editGeneration;

    const serverResponse = { ...state.draftConfig!, revision: 1, updatedAt: "2026-02-01T00:00:00.000Z" };
    state = reducer(state, saveDraftConfigSucceeded({ result: serverResponse, dispatchedForRole, dispatchedAtGeneration }));

    expect(state.draftConfig).toEqual(serverResponse);
    expect(state.isDirty).toBe(false);
  });

  it("ignores a stale save's response if the draft has since moved to a different role", () => {
    let state = reducer(initialState, loadDraftConfig(makeConfig([makeWidget({ id: "a", order: 1 })])));
    const dispatchedForRole = state.draftConfig!.role; // "financeManager"
    const dispatchedAtGeneration = state.editGeneration;

    state = reducer(state, setSelectedRole("supportAgent"));
    state = reducer(state, loadDraftConfig({ ...makeConfig([makeWidget({ id: "b", order: 1 })]), role: "supportAgent" }));

    const staleResponse = { ...makeConfig([makeWidget({ id: "a", order: 1 })]), revision: 1 };
    state = reducer(state, saveDraftConfigSucceeded({ result: staleResponse, dispatchedForRole, dispatchedAtGeneration }));

    // The now-current (supportAgent) draft must be untouched by the stale financeManager save.
    expect(state.draftConfig?.role).toBe("supportAgent");
    expect(state.draftConfig?.widgets[0].id).toBe("b");
  });
});
