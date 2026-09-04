// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WidgetShell from "@/components/dashboard/WidgetShell";

afterEach(cleanup);

describe("WidgetShell: presentation states", () => {
  it("loading: shows a skeleton and no content", () => {
    render(
      <WidgetShell title="Revenue" state="loading">
        <span>should not render</span>
      </WidgetShell>,
    );

    expect(screen.getByRole("status", { name: "Loading widget" })).toBeTruthy();
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("empty: shows the empty message and no content", () => {
    render(
      <WidgetShell title="Revenue" state="empty">
        <span>should not render</span>
      </WidgetShell>,
    );

    expect(screen.getByText("No data available.")).toBeTruthy();
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("error: shows the error message and calls onRetry when Retry is clicked", () => {
    const onRetry = vi.fn();
    render(<WidgetShell title="Revenue" state="error" errorMessage="Simulated failure" onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toContain("Simulated failure");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("error: falls back to a generic message when none is given, and omits Retry when no handler is passed", () => {
    render(<WidgetShell title="Revenue" state="error" />);

    expect(screen.getByRole("alert").textContent).toContain("Something went wrong loading this widget.");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("success: renders children and not the loading/empty/error chrome", () => {
    render(
      <WidgetShell title="Revenue" state="success">
        <span>actual widget content</span>
      </WidgetShell>,
    );

    expect(screen.getByText("actual widget content")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the title and optional meta label", () => {
    render(<WidgetShell title="Revenue" meta="Year to Date" state="success" />);

    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("Year to Date")).toBeTruthy();
  });
});
