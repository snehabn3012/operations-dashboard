// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WidgetErrorBoundary from "@/components/dashboard/WidgetErrorBoundary";

afterEach(cleanup);

function Bomb({ shouldThrow }: { shouldThrow: boolean }): ReactElement {
  if (shouldThrow) throw new Error("boom: widget render exploded");
  return <div>fine</div>;
}

describe("WidgetErrorBoundary: contains a widget crash to that one widget", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs the caught error to console.error -- expected noise for these tests, silenced so it doesn't look like a real test failure.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children normally when nothing throws", () => {
    render(
      <WidgetErrorBoundary resetKey="v1">
        <Bomb shouldThrow={false} />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeTruthy();
  });

  it("catches a render crash and shows a visible fallback instead of unmounting the whole tree", () => {
    render(
      <WidgetErrorBoundary resetKey="v1">
        <Bomb shouldThrow={true} />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("crashed");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("stays on the fallback across a re-render with the same resetKey (doesn't retry the same broken input forever, but doesn't loop either)", () => {
    const { rerender } = render(
      <WidgetErrorBoundary resetKey="v1">
        <Bomb shouldThrow={true} />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <WidgetErrorBoundary resetKey="v1">
        <Bomb shouldThrow={true} />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("resets and gives the new render a fresh chance once resetKey changes (e.g. the widget's config or data changed)", () => {
    const { rerender } = render(
      <WidgetErrorBoundary resetKey="v1">
        <Bomb shouldThrow={true} />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <WidgetErrorBoundary resetKey="v2">
        <Bomb shouldThrow={false} />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
