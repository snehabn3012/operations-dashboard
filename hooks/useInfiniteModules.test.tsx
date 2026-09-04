// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as mockApi from "@/data/mockApi";
import { useInfiniteModules } from "@/hooks/useInfiniteModules";
import { makeStore } from "@/store/store";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// "admin" sees all 18 catalog modules, all visible; PAGE_SIZE is 9, so this
// role always has exactly two pages -- a deterministic, role-driven way to
// exercise pagination without needing to fabricate fixture data.
function renderAdminHook() {
  const store = makeStore();
  return renderHook(() => useInfiniteModules("admin"), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
}

describe("useInfiniteModules: pagination", () => {
  it("loads the first page automatically, then loads the next page on loadMore", async () => {
    const { result } = renderAdminHook();

    expect(result.current.isInitialLoading).toBe(true);
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(result.current.modules.length).toBe(9);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.modules.length).toBe(18));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.total).toBe(18);
  });

  it("stops at the end of pagination: no further fetch once hasMore is false", async () => {
    const spy = vi.spyOn(mockApi, "getDashboardModules");
    const { result } = renderAdminHook();

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    const callsAtEnd = spy.mock.calls.length;
    act(() => result.current.loadMore()); // hasMore is false -- should be a no-op
    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(callsAtEnd);
    expect(result.current.modules.length).toBe(18); // unchanged
  });

  it("prevents a duplicate fetch when loadMore is called again while a page is already in flight", async () => {
    const spy = vi.spyOn(mockApi, "getDashboardModules");
    const { result } = renderAdminHook();

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    const callsAfterPage1 = spy.mock.calls.length;

    act(() => result.current.loadMore());
    expect(result.current.isFetchingMore).toBe(true);

    act(() => result.current.loadMore()); // still in flight -- guarded, must not fire another request
    await waitFor(() => expect(result.current.modules.length).toBe(18));

    expect(spy.mock.calls.length).toBe(callsAfterPage1 + 1); // exactly one request for page 2
  });

  it("on a failed page: keeps existing modules visible and surfaces a retryable error", async () => {
    const realImpl = mockApi.getDashboardModules;
    vi.spyOn(mockApi, "getDashboardModules").mockImplementation(async (role, page, limit) => {
      if (page === 2) throw new Error("Simulated pagination failure");
      return realImpl(role, page, limit);
    });

    const { result } = renderAdminHook();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(result.current.modules.length).toBe(9);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMoreError).toBe(true));

    // The already-loaded first page must survive a failed second page.
    expect(result.current.modules.length).toBe(9);
  });

  it("retry re-issues only the failed page and recovers", async () => {
    const realImpl = mockApi.getDashboardModules;
    let failPage2 = true;
    vi.spyOn(mockApi, "getDashboardModules").mockImplementation(async (role, page, limit) => {
      if (page === 2 && failPage2) throw new Error("Simulated pagination failure");
      return realImpl(role, page, limit);
    });

    const { result } = renderAdminHook();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMoreError).toBe(true));

    failPage2 = false; // simulate the underlying issue being resolved
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.modules.length).toBe(18));
    expect(result.current.hasMoreError).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });
});
