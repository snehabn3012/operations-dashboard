import { describe, expect, it } from "vitest";

import { getDefaultConfigForRole } from "@/config/dashboardConfig";

describe("getDefaultConfigForRole: role-scoped overrides are data-driven, not a role branch", () => {
  it("applies the self-scoped filter and title overrides to every widget for a self-scoped role (customer)", () => {
    const config = getDefaultConfigForRole("customer");

    expect(config.widgets.map((w) => w.id)).toEqual(["recent-transactions", "payments"]);
    for (const widget of config.widgets) {
      expect(widget.filter).toEqual({ value: "self", label: "My Activity" });
    }
    expect(config.widgets.find((w) => w.id === "recent-transactions")?.title).toBe("My Transactions");
    expect(config.widgets.find((w) => w.id === "payments")?.title).toBe("My Payments");
  });

  it("leaves titles and filters untouched for roles with no override table entry", () => {
    for (const role of ["admin", "operationsManager", "financeManager", "supportAgent"] as const) {
      const config = getDefaultConfigForRole(role);
      // None of these roles' widgets should have picked up the customer
      // role's "self" filter or renamed titles -- proves the overrides are
      // scoped by role, not accidentally applied globally.
      for (const widget of config.widgets) {
        expect(widget.filter?.value).not.toBe("self");
        expect(widget.title).not.toBe("My Transactions");
        expect(widget.title).not.toBe("My Payments");
      }
    }
  });

  it("a widget shared between customer and another role only carries the override in the customer's config", () => {
    // "payments" is also in financeManager's module list -- its title/filter
    // there must be the catalog defaults, not customer's overrides leaking
    // across roles via shared object references.
    const financeConfig = getDefaultConfigForRole("financeManager");
    const paymentsForFinance = financeConfig.widgets.find((w) => w.id === "payments");

    expect(paymentsForFinance?.title).toBe("Payments");
    expect(paymentsForFinance?.filter?.value).not.toBe("self");
  });
});
