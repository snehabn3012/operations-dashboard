import { describe, expect, it } from "vitest";

import { computeMetric } from "@/lib/metrics";
import { DataRow, DataSourceResult } from "@/types/dashboard";

function makeResult(rows: DataRow[], valueField = "amount"): DataSourceResult {
  return {
    source: "transactions",
    series: [],
    rows,
    columns: [],
    valueField,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("computeMetric: does not silently coerce bad data into 0", () => {
  it("sum: adds only the numeric rows and reports how many were excluded", () => {
    const data = makeResult([
      { id: "1", amount: 100 },
      { id: "2", amount: "not-a-number" }, // drifted from numeric to text
      { id: "3" }, // field renamed/removed entirely
      { id: "4", amount: 50 },
    ]);

    const result = computeMetric(data, "sum");

    expect(result.value).toBe(150); // 100 + 50, NOT 150 + (0 + 0) masquerading as correct
    expect(result.invalidCount).toBe(2);
  });

  it("sum: reports no invalid rows when every value is genuinely numeric", () => {
    const data = makeResult([{ id: "1", amount: 10 }, { id: "2", amount: 20 }]);
    const result = computeMetric(data, "sum");
    expect(result).toEqual({ value: 30, invalidCount: 0 });
  });

  it("average: divides by the count of VALID rows, not every row -- excluding bad data changes the denominator, not just the numerator", () => {
    const data = makeResult([
      { id: "1", amount: 100 },
      { id: "2", amount: "garbage" },
      { id: "3", amount: 200 },
    ]);

    const result = computeMetric(data, "average");

    // (100 + 200) / 2 valid rows = 150 -- not / 3 total rows (which would silently understate it as 100)
    expect(result.value).toBe(150);
    expect(result.invalidCount).toBe(1);
  });

  it("average: is 0, not NaN, when every row is invalid", () => {
    const data = makeResult([{ id: "1", amount: "bad" }, { id: "2" }]);
    const result = computeMetric(data, "average");
    expect(result.value).toBe(0);
    expect(result.invalidCount).toBe(2);
  });

  it("latest: flags an invalid most-recent row instead of silently reporting 0 as if it were real", () => {
    const data = makeResult([{ id: "1", amount: "corrupted" }]);
    const result = computeMetric(data, "latest");
    expect(result.value).toBe(0);
    expect(result.invalidCount).toBe(1); // distinguishes "genuinely 0" from "couldn't read a value"
  });

  it("latest: a genuinely valid value is never flagged", () => {
    const data = makeResult([{ id: "1", amount: 42 }]);
    expect(computeMetric(data, "latest")).toEqual({ value: 42, invalidCount: 0 });
  });

  it("count: never touches valueField, so it's never affected by invalid values", () => {
    const data = makeResult([{ id: "1", amount: "garbage" }, { id: "2" }]);
    expect(computeMetric(data, "count")).toEqual({ value: 2, invalidCount: 0 });
  });
});
