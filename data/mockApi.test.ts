// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  getDashboardConfig,
  getDashboardConfigById,
  getDashboardModulesById,
  getOrders,
  getTransactions,
  updateDashboardConfig,
} from "@/data/mockApi";
import { CONFIG_CONFLICT_ERROR, DASHBOARD_NOT_FOUND_ERROR } from "@/types/dashboard";

// jsdom (not the default node environment) so configStore's localStorage
// backing actually persists between calls within a test, the same way it
// would in a real browser tab -- see data/mockApi.ts.
//
// Each test uses its own role so they don't interfere via the shared
// localStorage-backed store: there's no reset hook between tests, so
// isolation comes from never touching the same role twice.

describe("updateDashboardConfig: optimistic concurrency", () => {
  it("accepts a save based on the currently stored revision, and bumps it", async () => {
    const loaded = await getDashboardConfig("operationsManager");

    const saved = await updateDashboardConfig("operationsManager", {
      ...loaded,
      widgets: loaded.widgets.map((w) => ({ ...w, visible: false })),
    });

    expect(saved.revision).toBe(loaded.revision + 1);
    expect(saved.widgets.every((w) => !w.visible)).toBe(true);
  });

  it("rejects a save based on a stale revision without touching the already-saved config", async () => {
    const loaded = await getDashboardConfig("financeManager");

    // First editor's save lands, based on the revision both editors started from.
    const firstSave = await updateDashboardConfig("financeManager", loaded);

    // Second editor is still holding the pre-save revision and tries to save on top of it.
    await expect(updateDashboardConfig("financeManager", loaded)).rejects.toThrow(CONFIG_CONFLICT_ERROR);

    // The rejected write must not have clobbered the first editor's successful save.
    const current = await getDashboardConfig("financeManager");
    expect(current.revision).toBe(firstSave.revision);
    expect(current.updatedAt).toBe(firstSave.updatedAt);
  });

  it("accepts a retried save once the client reloads the latest revision", async () => {
    await updateDashboardConfig("customer", await getDashboardConfig("customer")); // revision 0 -> 1
    const latest = await getDashboardConfig("customer"); // now at revision 1

    const retried = await updateDashboardConfig("customer", latest);

    expect(retried.revision).toBe(2);
  });
});

describe("group-by: bucketing switches from calendar-month to a categorical field", () => {
  it("groups by month by default (no groupBy requested)", async () => {
    const result = await getTransactions();
    // Default monthly bucketing always produces exactly 6 points (the window size), never a per-status/customer breakdown.
    expect(result.series.length).toBe(6);
  });

  it("groups by a valid categorical field instead, when requested", async () => {
    const result = await getTransactions({ groupBy: "status" });
    const labels = result.series.map((p) => p.label).sort();
    // Transaction status is one of completed/pending/failed -- never a month name.
    expect(labels.every((label) => ["completed", "pending", "failed"].includes(label))).toBe(true);
    // Only 3 distinct statuses, well under the grouping cap, so every row is
    // accounted for with no summary bucket needed.
    const total = result.series.reduce((sum, p) => sum + p.value, 0);
    expect(total).toBe(result.rows.length);
  });

  it("falls back to month bucketing for a groupBy field that isn't valid for this data source", async () => {
    const result = await getOrders({ groupBy: "not-a-real-field" });
    expect(result.series.length).toBe(6); // unchanged default, not an error, not an empty result
  });

  it("high-cardinality group-by (many distinct customers) is capped with a visible summary bucket, not silently truncated", async () => {
    const result = await getTransactions({ groupBy: "customerName" });
    const totalGrouped = result.series.reduce((sum, p) => sum + p.value, 0);
    const totalRows = (await getTransactions()).rows.length;

    expect(totalGrouped).toBe(totalRows); // every row still accounted for
    // There are more than 8 distinct customer names in the mock data, so the
    // tail must be folded into one visible summary point.
    expect(result.series.some((p) => p.label.startsWith("+ ") && p.label.endsWith(" more"))).toBe(true);
  });
});

describe("dashboard identity: stable, independent of role", () => {
  it("assigns a real id on first access and keeps returning the same one on every subsequent read", async () => {
    const first = await getDashboardConfig("admin");
    const second = await getDashboardConfig("admin");

    expect(first.id).toBeTruthy();
    expect(second.id).toBe(first.id);
  });

  it("getDashboardConfigById resolves the exact same dashboard the role-based path returns", async () => {
    const byRole = await getDashboardConfig("admin");
    const byId = await getDashboardConfigById(byRole.id);

    expect(byId.id).toBe(byRole.id);
    expect(byId.role).toBe("admin");
    expect(byId.widgets.length).toBe(byRole.widgets.length);
  });

  it("getDashboardConfigById rejects with DASHBOARD_NOT_FOUND_ERROR for an id nothing has ever created", async () => {
    await expect(getDashboardConfigById("this-id-was-never-created")).rejects.toThrow(DASHBOARD_NOT_FOUND_ERROR);
  });

  it("getDashboardModulesById paginates the same dashboard the role-based endpoint would", async () => {
    const config = await getDashboardConfig("admin"); // 18 widgets, all visible
    const page1 = await getDashboardModulesById(config.id, 1, 9);

    expect(page1.modules.length).toBe(9);
    expect(page1.total).toBe(18);
    expect(page1.hasMore).toBe(true);
  });

  it("getDashboardModulesById rejects with DASHBOARD_NOT_FOUND_ERROR for an unknown id", async () => {
    await expect(getDashboardModulesById("this-id-was-never-created", 1, 9)).rejects.toThrow(DASHBOARD_NOT_FOUND_ERROR);
  });

  it("the id survives a save -- a save is an edit to the same dashboard, not a new one", async () => {
    const loaded = await getDashboardConfig("supportAgent");

    const saved = await updateDashboardConfig("supportAgent", {
      ...loaded,
      widgets: loaded.widgets.map((w) => ({ ...w, visible: false })),
    });

    expect(saved.id).toBe(loaded.id);
    const byId = await getDashboardConfigById(loaded.id);
    expect(byId.id).toBe(loaded.id);
    expect(byId.widgets.every((w) => !w.visible)).toBe(true);
  });

  it("actually lands in localStorage, not just an in-memory variable -- what makes it survive a page reload", async () => {
    const saved = await updateDashboardConfig("admin", await getDashboardConfig("admin"));

    const raw = window.localStorage.getItem("opsdash:dashboards:v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Record<string, { id: string }>;
    expect(parsed[saved.id]?.id).toBe(saved.id);
  });
});
