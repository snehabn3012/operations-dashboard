// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";

import WidgetRenderer from "@/components/dashboard/WidgetRenderer";
import { makeStore } from "@/store/store";
import { SIMULATE_ERROR_VALUE, WidgetConfig } from "@/types/dashboard";

afterEach(cleanup);

const BASE_WIDGET: WidgetConfig = {
  id: "hostile-widget",
  title: "Hostile Widget",
  dataSource: "transactions",
  widgetType: "table",
  visible: true,
  order: 1,
  layout: { width: 6, height: 2 },
};

describe("WidgetRenderer: hostile configuration reaching the render layer", () => {
  it("renders 'Unsupported widget' instead of crashing when widgetType isn't in the registry", () => {
    // A malformed config can carry an arbitrary string here -- validateDashboardConfig
    // deliberately does not restrict widgetType to a known enum (see
    // lib/configValidator.test.ts), so this is a realistic value to reach the renderer.
    const hostile = { ...BASE_WIDGET, widgetType: "pieChart" } as unknown as WidgetConfig;

    render(<WidgetRenderer config={hostile} />);

    // getByText throws (failing the test) if the element isn't found, so reaching
    // these lines at all is already proof the fallback rendered instead of crashing.
    expect(screen.getByText("Unsupported widget").textContent).toBe("Unsupported widget");
    expect(screen.getByText(/pieChart/).textContent).toContain("pieChart");
  });

  it("renders an 'Unknown data source' error instead of crashing when dataSource isn't in the registry", () => {
    const hostile = { ...BASE_WIDGET, dataSource: "bigfoot" } as unknown as WidgetConfig;

    render(<WidgetRenderer config={hostile} />);

    expect(screen.getByText("Unknown data source.").textContent).toBe("Unknown data source.");
  });
});

function renderWithStore(...configs: WidgetConfig[]) {
  return render(
    <Provider store={makeStore()}>
      {configs.map((config) => (
        <WidgetRenderer key={config.id} config={config} />
      ))}
    </Provider>,
  );
}

describe("WidgetRenderer: real data fetching states", () => {
  it("shows a loading skeleton, then renders successfully for a normally-configured widget", async () => {
    const widget: WidgetConfig = { ...BASE_WIDGET, id: "txns", dataSource: "transactions", widgetType: "table" };
    renderWithStore(widget);

    expect(screen.getByRole("status", { name: "Loading widget" })).toBeTruthy();

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), { timeout: 3000 });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a loading skeleton, then an error, when the widget's filter simulates a failure", async () => {
    const widget: WidgetConfig = { ...BASE_WIDGET, id: "err", filter: { value: SIMULATE_ERROR_VALUE, label: "Simulate Error" } };
    renderWithStore(widget);

    expect(screen.getByRole("status", { name: "Loading widget" })).toBeTruthy();

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByRole("alert").textContent).toContain("Simulated failure");
  });

  it("isolates widget failures: one widget's error doesn't affect a sibling widget's success", async () => {
    const failing: WidgetConfig = { ...BASE_WIDGET, id: "failing", filter: { value: SIMULATE_ERROR_VALUE, label: "Simulate Error" } };
    const healthy: WidgetConfig = { ...BASE_WIDGET, id: "healthy", dataSource: "orders", widgetType: "table" };
    renderWithStore(failing, healthy);

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBe(1); // only the failing widget
      expect(screen.queryAllByRole("status").length).toBe(0); // both settled, none stuck loading
    }, { timeout: 3000 });
  });

  /**
   * Reproduces a bug found live: RTK Query keeps serving a query's *previous*
   * args' data (isFetching: true, isLoading: false) while a newly-changed
   * args combination is still in flight, to avoid flicker on a plain
   * revalidation. But this widget's title/meta caption is driven by the same
   * `config` prop in the same render, so it updates to the new filter's label
   * immediately -- if WidgetRenderer trusted that stale `data` because it
   * only checked `isLoading`, the widget would show the *old* filter's rows
   * under the *new* filter's label, with no loading indicator, for as long
   * as the fetch takes. Verified live against the running app with two
   * dashboard-level filters on the same data source (DESIGN.md section 18);
   * this reproduces the same class of race deterministically in-process.
   */
  it("never shows one filter's data under a different filter's label: a filter change either shows a loading state or the new filter's own data, never a stale mix", async () => {
    const store = makeStore();
    const widget: WidgetConfig = {
      ...BASE_WIDGET,
      id: "payments-race",
      dataSource: "payments",
      widgetType: "table",
      filter: { value: "successful", label: "Successful" },
    };

    const { rerender } = render(
      <Provider store={store}>
        <WidgetRenderer config={widget} />
      </Provider>,
    );

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), { timeout: 3000 });
    const initialStatuses = screen.getAllByRole("cell").filter((c) => c.getAttribute("data-key") === "status");
    expect(initialStatuses.length).toBeGreaterThan(0);
    for (const cell of initialStatuses) expect(cell.textContent).toBe("successful");

    // Switch to a filter value this store has never fetched before -- the
    // exact condition that exposed the race (a genuinely new args key, not
    // one some other already-rendered widget happened to have pre-cached).
    const changed: WidgetConfig = { ...widget, filter: { value: "failed", label: "Failed" } };
    rerender(
      <Provider store={store}>
        <WidgetRenderer config={changed} />
      </Provider>,
    );

    // Check immediately (no await) -- this is the exact instant the original
    // bug occurred: label already updated, data not yet caught up.
    const statusCellsNow = screen.queryAllByRole("cell").filter((c) => c.getAttribute("data-key") === "status");
    const isLoadingNow = Boolean(screen.queryByRole("status"));
    if (!isLoadingNow) {
      // Not showing a loading state -- so whatever data IS showing must
      // already be the new filter's, never the old filter's leftovers.
      for (const cell of statusCellsNow) expect(cell.textContent).not.toBe("successful");
    }

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), { timeout: 3000 });
    const finalStatuses = screen.getAllByRole("cell").filter((c) => c.getAttribute("data-key") === "status");
    expect(finalStatuses.length).toBeGreaterThan(0);
    for (const cell of finalStatuses) expect(cell.textContent).toBe("failed");
  });
});
