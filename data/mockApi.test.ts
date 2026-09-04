import { describe, expect, it } from "vitest";

import { getDashboardConfig, updateDashboardConfig } from "@/data/mockApi";
import { CONFIG_CONFLICT_ERROR } from "@/types/dashboard";

// Each test uses its own role so they don't interfere via the shared in-memory
// configStore -- there's no reset hook between tests, so isolation comes from
// never touching the same role twice.

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
