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
});
