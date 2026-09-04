import { describe, expect, it } from "vitest";

import { groupRowsByField, MAX_GROUPS } from "@/lib/grouping";
import { DataRow } from "@/types/dashboard";

function row(id: string, fields: Record<string, unknown>): DataRow {
  return { id, ...fields };
}

describe("groupRowsByField", () => {
  it("counts rows per group by default", () => {
    const rows = [
      row("1", { status: "active" }),
      row("2", { status: "active" }),
      row("3", { status: "inactive" }),
    ];

    const result = groupRowsByField(rows, "status");

    expect(result).toEqual([
      { label: "active", value: 2 },
      { label: "inactive", value: 1 },
    ]);
  });

  it("sums a value field per group when metric is sum", () => {
    const rows = [
      row("1", { status: "completed", amount: 100 }),
      row("2", { status: "completed", amount: 50 }),
      row("3", { status: "failed", amount: 20 }),
    ];

    const result = groupRowsByField(rows, "status", "sum", "amount");

    expect(result).toEqual([
      { label: "completed", value: 150 },
      { label: "failed", value: 20 },
    ]);
  });

  it("does not silently drop rows for a high-cardinality field -- folds the tail into one visible '+ N more' bucket", () => {
    // 50 distinct customer names, one row each -- more than any dashboard
    // should render as separate bars, but every row must still be accounted for.
    const rows = Array.from({ length: 50 }, (_, i) => row(String(i), { customerName: `Customer ${i}` }));

    const result = groupRowsByField(rows, "customerName");

    expect(result.length).toBe(MAX_GROUPS + 1); // MAX_GROUPS real groups + one summary bucket
    const summary = result[result.length - 1];
    expect(summary.label).toBe(`+ ${50 - MAX_GROUPS} more`);

    // Every row is still represented somewhere -- nothing silently vanished.
    const totalAccounted = result.reduce((sum, point) => sum + point.value, 0);
    expect(totalAccounted).toBe(50);
  });

  it("groups missing/empty field values into a visible '(none)' bucket rather than skipping those rows", () => {
    const rows = [row("1", { segment: "enterprise" }), row("2", { segment: undefined }), row("3", {})];

    const result = groupRowsByField(rows, "segment");

    expect(result.find((p) => p.label === "(none)")?.value).toBe(2);
  });
});
