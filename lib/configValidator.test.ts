import { describe, expect, it } from "vitest";

import { CURRENT_CONFIG_VERSION, getDefaultConfigForRole } from "@/config/dashboardConfig";
import { validateDashboardConfig } from "@/lib/configValidator";

describe("validateDashboardConfig: hostile input", () => {
  // Both sides call `new Date().toISOString()` independently (once inside
  // validateDashboardConfig's fallback, once here for comparison), so
  // `updatedAt` is compared separately -- a millisecond boundary crossed
  // between the two calls would otherwise make this flaky.
  function expectEqualsDefaultConfig(result: ReturnType<typeof getDefaultConfigForRole>, role: Parameters<typeof getDefaultConfigForRole>[0]) {
    const expected = getDefaultConfigForRole(role);
    expect(result.role).toEqual(expected.role);
    expect(result.version).toEqual(expected.version);
    expect(result.revision).toEqual(expected.revision);
    expect(result.widgets).toEqual(expected.widgets);
  }

  it("falls back to role defaults for input that isn't even shaped like a config", () => {
    for (const hostile of [null, undefined, "not a config", 42, [], { widgets: "not an array" }]) {
      expectEqualsDefaultConfig(validateDashboardConfig(hostile, "financeManager"), "financeManager");
    }
  });

  it("falls back to role defaults when every widget in the array is unusable", () => {
    const allUnusable = {
      widgets: [
        { id: "a", dataSource: "not-a-real-source" },
        { id: "b", dataSource: "also-fake" },
        "garbage",
        123,
        null,
      ],
    };

    expectEqualsDefaultConfig(validateDashboardConfig(allUnusable, "supportAgent"), "supportAgent");
  });

  it("normalizes a deliberately hostile mix instead of crashing or losing the salvageable widgets", () => {
    const hostile = {
      version: 999, // stale/unknown version number
      updatedAt: "not-a-real-date-but-a-string-so-its-kept",
      widgets: [
        // 1. Unknown data source -> must be dropped entirely.
        { id: "ghost", title: "Ghost", dataSource: "bigfoot", widgetType: "kpi", visible: true, layout: { width: 6, height: 2 }, order: 1 },
        // 2. Not an object at all -> must be dropped entirely.
        "not-a-widget",
        // 3. Unsupported widgetType with an otherwise-valid data source -> must survive
        //    (validation doesn't gatekeep widgetType; WidgetRenderer's registry lookup
        //    is what turns this into an "Unsupported widget" render, not a crash here).
        { id: "pie", title: "Pie", dataSource: "transactions", widgetType: "pieChart", visible: true, layout: { width: 6, height: 2 }, order: 2 },
        // 4. Missing title/layout entirely, but id matches the module catalog -> must be
        //    backfilled from MODULE_CATALOG rather than left undefined.
        { id: "revenue", dataSource: "revenue" },
        // 5. Layout values that are out of range / not even numbers -> must be clamped,
        //    not passed through as -5 or NaN.
        { id: "wild-layout", title: "Wild Layout", dataSource: "orders", widgetType: "table", visible: true, layout: { width: -5, height: "huge" }, order: 4 },
      ],
    };

    const result = validateDashboardConfig(hostile, "admin");

    // Never throws, and always returns the current schema version regardless of what
    // the stale input claimed.
    expect(result.version).toBe(CURRENT_CONFIG_VERSION);
    expect(result.role).toBe("admin");

    const ids = result.widgets.map((w) => w.id);
    expect(ids).not.toContain("ghost"); // unknown data source dropped
    expect(ids).toEqual(["pie", "revenue", "wild-layout"]); // salvageable widgets survive, in hint order

    const pie = result.widgets.find((w) => w.id === "pie")!;
    expect(pie.widgetType).toBe("pieChart"); // passed through untouched, not silently coerced

    const revenue = result.widgets.find((w) => w.id === "revenue")!;
    expect(revenue.title).toBe("Revenue"); // backfilled from MODULE_CATALOG
    expect(revenue.layout).toEqual({ width: 3, height: 1 }); // backfilled from MODULE_CATALOG

    const wildLayout = result.widgets.find((w) => w.id === "wild-layout")!;
    expect(wildLayout.layout).toEqual({ width: 1, height: 1 }); // clamped into range, not left invalid

    // order is resynced to array position for every surviving widget, ignoring whatever
    // (possibly stale/duplicated) order hints the hostile input carried.
    expect(result.widgets.map((w) => w.order)).toEqual([1, 2, 3]);

    // No revision was supplied at all -> must default rather than come out undefined
    // (the optimistic-concurrency check in updateDashboardConfig relies on this).
    expect(result.revision).toBe(0);
  });

  it("preserves a legitimate revision but defaults a garbage one, rather than ever leaving it undefined", () => {
    const base = { widgets: [{ id: "revenue", dataSource: "revenue" }] };

    expect(validateDashboardConfig({ ...base, revision: 7 }, "admin").revision).toBe(7);
    expect(validateDashboardConfig({ ...base, revision: "not-a-number" }, "admin").revision).toBe(0);
    expect(validateDashboardConfig({ ...base, revision: null }, "admin").revision).toBe(0);
    expect(validateDashboardConfig(base, "admin").revision).toBe(0);
  });
});
