// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TableWidget from "@/components/widgets/TableWidget";
import { DataSourceResult, WidgetConfig } from "@/types/dashboard";

afterEach(cleanup);

const BASE_CONFIG: WidgetConfig = {
  id: "w1",
  title: "Transactions",
  dataSource: "transactions",
  widgetType: "table",
  visible: true,
  order: 1,
  layout: { width: 6, height: 2 },
};

const DATA: DataSourceResult = {
  source: "transactions",
  series: [],
  rows: [{ id: "1", customerName: "Ava", amount: 42, status: "completed", date: "2026-01-01" }],
  columns: [
    { key: "id", label: "Transaction" },
    { key: "customerName", label: "Customer" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
    { key: "date", label: "Date" },
  ],
  valueField: "amount",
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TableWidget: field selection", () => {
  it("shows every column when no fields are configured (pre-existing default)", () => {
    render(<TableWidget config={BASE_CONFIG} data={DATA} />);
    for (const col of DATA.columns) {
      expect(screen.getByText(col.label)).toBeTruthy();
    }
  });

  it("shows only the configured fields, in the configured order", () => {
    const config: WidgetConfig = { ...BASE_CONFIG, fields: ["status", "customerName"] };
    render(<TableWidget config={config} data={DATA} />);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Status", "Customer"]);
    expect(screen.queryByText("Transaction")).toBeNull();
    expect(screen.queryByText("Amount")).toBeNull();
  });

  it("falls back to all columns when every configured field has drifted away (no longer exists on this source)", () => {
    const config: WidgetConfig = { ...BASE_CONFIG, fields: ["a-field-that-no-longer-exists"] };
    render(<TableWidget config={config} data={DATA} />);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(DATA.columns.map((c) => c.label)); // not an empty/broken table
  });
});

describe("TableWidget: row truncation is visible, not silent", () => {
  function rowsOf(count: number): DataSourceResult["rows"] {
    return Array.from({ length: count }, (_, i) => ({
      id: `${i}`,
      customerName: `Customer ${i}`,
      amount: i,
      status: "completed",
      date: "2026-01-01",
    }));
  }

  it("shows no truncation notice when every row fits", () => {
    render(<TableWidget config={BASE_CONFIG} data={{ ...DATA, rows: rowsOf(8) }} />);
    expect(screen.getAllByRole("row")).toHaveLength(9); // 8 data rows + header row
    expect(screen.queryByText(/more not shown/)).toBeNull();
  });

  it("caps rendered rows at MAX_VISIBLE_ROWS and states exactly how many were left out", () => {
    render(<TableWidget config={BASE_CONFIG} data={{ ...DATA, rows: rowsOf(21) }} />);
    expect(screen.getAllByRole("row")).toHaveLength(9); // 8 data rows + header row
    expect(screen.getByText("Showing 8 of 21 rows · 13 more not shown")).toBeTruthy();
  });
});
