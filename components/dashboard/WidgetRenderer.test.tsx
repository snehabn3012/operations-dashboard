// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WidgetRenderer from "@/components/dashboard/WidgetRenderer";
import { WidgetConfig } from "@/types/dashboard";

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
