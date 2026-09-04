// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";

import ConfigurationPanel from "@/components/configuration/ConfigurationPanel";
import { getDashboardConfig, updateDashboardConfig } from "@/data/mockApi";
import { makeStore } from "@/store/store";

// Each test renders its own store/component tree; without this, a previous
// test's DOM stays mounted and queries like getByRole start matching more
// than one element across tests in this file.
afterEach(cleanup);

/**
 * Regression test for a bug where switching roles left the canvas showing the
 * *previous* role's widgets: useGetDashboardConfigQuery briefly still returns
 * the old role's cached data while the new role's request is in flight, and
 * the draft-seeding effect didn't check that the fetched config actually
 * belonged to the newly selected role before locking it in as the draft.
 * Once locked in, nothing else re-triggered the seed, so it took an *extra*
 * role switch to "catch up" -- this test fails if that regresses, because
 * without the role check the canvas would get stuck rather than eventually
 * reach the new role's widget count.
 */
describe("ConfigurationPanel: role switching", () => {
  it("updates the canvas to the newly selected role's widgets on the very first switch, every time", async () => {
    render(
      <Provider store={makeStore()}>
        <ConfigurationPanel />
      </Provider>,
    );

    await waitFor(() => expect(screen.getAllByTestId("canvas-card").length).toBe(18)); // admin: all modules

    screen.getByRole("radio", { name: "Finance Manager" }).click();
    await waitFor(() => expect(screen.getAllByTestId("canvas-card").length).toBe(5), { timeout: 5000 });

    screen.getByRole("radio", { name: "Support Agent" }).click();
    await waitFor(() => expect(screen.getAllByTestId("canvas-card").length).toBe(3), { timeout: 5000 });

    screen.getByRole("radio", { name: "Admin" }).click();
    await waitFor(() => expect(screen.getAllByTestId("canvas-card").length).toBe(18), { timeout: 5000 });
  });
});

describe("ConfigurationPanel: undo/redo", () => {
  it("enables Undo after an edit, reverts it, then enables Redo to reapply it", async () => {
    render(
      <Provider store={makeStore()}>
        <ConfigurationPanel />
      </Provider>,
    );

    await waitFor(() => expect(screen.getAllByTestId("canvas-card").length).toBe(18));

    const undoButton = () => screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    const redoButton = () => screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement;
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(true);

    // Select the first widget and hide it.
    screen.getAllByTestId("canvas-card")[0].click();
    const visibleCheckbox = (await screen.findByLabelText("Visible on dashboard")) as HTMLInputElement;
    expect(visibleCheckbox.checked).toBe(true);
    visibleCheckbox.click();
    expect(visibleCheckbox.checked).toBe(false);

    await waitFor(() => expect(undoButton().disabled).toBe(false));
    expect(redoButton().disabled).toBe(true);

    undoButton().click();
    await waitFor(() => expect((screen.getByLabelText("Visible on dashboard") as HTMLInputElement).checked).toBe(true));
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(false);

    redoButton().click();
    await waitFor(() => expect((screen.getByLabelText("Visible on dashboard") as HTMLInputElement).checked).toBe(false));
    expect(undoButton().disabled).toBe(false);
    expect(redoButton().disabled).toBe(true);
  });
});

describe("ConfigurationPanel: save conflict", () => {
  it("shows the conflict banner and preserves the local (unsaved) draft rather than discarding or overwriting it", async () => {
    render(
      <Provider store={makeStore()}>
        <ConfigurationPanel />
      </Provider>,
    );

    await waitFor(() => expect(screen.getAllByTestId("canvas-card").length).toBe(18));

    // Make a local edit (leave the drawer open so we can re-check its state after the conflict).
    screen.getAllByTestId("canvas-card")[0].click();
    const visibleCheckbox = (await screen.findByLabelText("Visible on dashboard")) as HTMLInputElement;
    visibleCheckbox.click();
    expect(visibleCheckbox.checked).toBe(false);

    // Simulate a second editor: read-then-write the currently stored config
    // unchanged, which succeeds (it's still on the current revision) and
    // bumps the stored revision -- exactly what "someone else saved changes"
    // looks like from this component's perspective.
    await updateDashboardConfig("admin", await getDashboardConfig("admin"));

    // This save is now based on a stale revision.
    screen.getByRole("button", { name: "Save Configuration" }).click();

    await screen.findByText(/changed by someone else/);

    // The local edit must still be there -- neither reverted to the
    // pre-edit state nor overwritten by the other editor's (identical, in
    // this case) save.
    expect((screen.getByLabelText("Visible on dashboard") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });
});
