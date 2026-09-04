// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ListWidget from "@/components/widgets/ListWidget";
import { DataSourceResult, WidgetConfig } from "@/types/dashboard";

afterEach(cleanup);

const BASE_CONFIG: WidgetConfig = {
  id: "w1",
  title: "Transactions",
  dataSource: "transactions",
  widgetType: "list",
  visible: true,
  order: 1,
  layout: { width: 6, height: 2 },
};

function rowsOf(count: number): DataSourceResult["rows"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    customerName: `Customer ${i}`,
    amount: i,
    status: "completed",
  }));
}

const DATA: DataSourceResult = {
  source: "transactions",
  series: [],
  rows: rowsOf(3),
  columns: [
    { key: "id", label: "Transaction" },
    { key: "customerName", label: "Customer" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
  ],
  valueField: "amount",
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ListWidget: row truncation is visible, not silent", () => {
  it("shows no truncation notice when every row fits", () => {
    render(<ListWidget config={BASE_CONFIG} data={{ ...DATA, rows: rowsOf(8) }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByText(/more not shown/)).toBeNull();
  });

  it("caps rendered items at MAX_VISIBLE_ROWS and states exactly how many were left out", () => {
    render(<ListWidget config={BASE_CONFIG} data={{ ...DATA, rows: rowsOf(11) }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText("Showing 8 of 11 items · 3 more not shown")).toBeTruthy();
  });
});
