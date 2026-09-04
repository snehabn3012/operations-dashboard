# Design Document — Operations Dashboard

This document explains the architecture and the reasoning behind it. The brief's own framing (section 28, "Most Important Architectural Principle") is the design's north star:

> The dashboard must be configuration-driven. Data, presentation, layout, permissions, client state, server state, and module loading should be separate concerns. The dashboard component itself should not need to be modified when a widget is hidden/shown, a widget's type changes, a role is added, a module is added, the layout changes, more modules load through pagination, or the backend replaces the mock API.

Everything below either implements that principle directly or explains where the prototype deliberately cut scope to stay a prototype.

## 1. Architecture overview

```text
Mock API (data/mockApi.ts)
     ↓
RTK Query (store/api/dashboardApi.ts)
     ↓
Server/Data State
     ↓
Dashboard Configuration (config/dashboardConfig.ts, lib/configValidator.ts)
     ↓
Permissions (role → module ids, expressed as data, not code)
     ↓
Widget Renderer (components/dashboard/WidgetRenderer.tsx)
     ↓
Widget Presentation (config/widgetRegistry.ts)
     ↓
Layout (lib/layoutBuckets.ts + DashboardGrid.module.css)
```

Client state (Redux Toolkit, `store/dashboardSlice.ts`): selected role, draft configuration, unsaved-changes flag.
Server state (RTK Query, `store/api/dashboardApi.ts`): the five data sources, dashboard configuration, paginated modules — fetching, caching, loading/error, mutation, invalidation.

## 2. How each "must not change" guarantee is satisfied

| Change | Mechanism | Where |
|---|---|---|
| Widget hidden/shown | `visible` is a field on `WidgetConfig`; `getDashboardModules` filters on it server-side and the renderer never branches on it | `data/mockApi.ts`, `types/dashboard.ts` |
| Widget type changes (Bar Chart → KPI) | `widgetRegistry` is a `WidgetType → component` lookup; `WidgetRenderer` resolves it by key, no `if`/`switch` | `config/widgetRegistry.ts`, `components/dashboard/WidgetRenderer.tsx` |
| A new role is added | Role → module-id list is a data map (`ROLE_MODULE_IDS`); `Dashboard.tsx` only reads `selectedRole` from Redux and never branches on which role it is | `config/dashboardConfig.ts`, `components/dashboard/Dashboard.tsx` |
| A new module is added | Add an entry to `MODULE_CATALOG` (and optionally `WIDGET_PALETTE`); nothing in the renderer or dashboard shell changes | `config/dashboardConfig.ts`, `config/widgetPalette.ts` |
| Dashboard layout changes | Each widget carries its own `layout: {width, height}`; `lib/layoutBuckets.ts` snaps it into the grid's supported buckets; one shared `DashboardGrid.module.css` is used by both `/dashboard` and the `/configure` canvas | `lib/layoutBuckets.ts`, `components/dashboard/DashboardGrid.module.css` |
| More modules load via pagination | `useInfiniteModules` owns the page cursor; RTK Query's custom `serializeQueryArgs`/`merge` accumulate pages into one cache entry per role, so `ModuleLoader` just renders whatever list it's handed | `hooks/useInfiniteModules.ts`, `store/api/dashboardApi.ts` |
| Backend replaces the mock API | Every mock function is wrapped by exactly one RTK Query `queryFn` in `dashboardApi.ts`; swapping `fakeBaseQuery` for `fetchBaseQuery` and pointing each `queryFn` at a real endpoint is the only change needed — no consumer of these hooks changes | `store/api/dashboardApi.ts`, `data/mockApi.ts` |
| Config is missing/invalid/malformed/from an old version | `validateDashboardConfig` normalizes any payload before it reaches a component, falling back to role defaults instead of throwing; an unresolvable `widgetType` renders `UnsupportedWidget` instead of crashing | `lib/configValidator.ts`, `components/widgets/UnsupportedWidget.tsx` |

## 3. State management split

- **RTK Query** owns everything that is, conceptually, server data: customers/transactions/revenue/orders/payments, dashboard configuration (`getDashboardConfig`/`updateDashboardConfig`), and paginated modules. It's used even against the mock API (via `fakeBaseQuery`), specifically so caching/loading/error/invalidation behave the same way they would against a real backend — see the "backend replaces the mock API" row above.
- **Redux Toolkit** (`dashboardSlice.ts`) owns only client/UI state: `selectedRole`, `draftConfig`, `isDirty`, and the local undo/redo history (`past`/`future`, see section 10). The draft *is* the live preview — the `/configure` canvas renders directly from `draftConfig`, so there's no second copy of "what the preview shows" to keep in sync.
- Server data is never duplicated into Redux. The one intentional exception is `draftConfig`: it starts as a copy of the RTK-Query-fetched saved config (seeded once, on load) so it can be edited locally before a mutation commits it back.

## 4. Configuration model & validation

`WidgetConfig` (`types/dashboard.ts`) is the strongly-typed unit of configuration: `id`, `title`, `dataSource`, `widgetType`, `visible`, `order`, `layout`, plus optional `filter`/`sort`/`metric`. `order` is resynced to array position on every mutation (add/remove/reorder) in the slice, so it's always a reliable render order.

Anything that didn't just come out of the Redux store (i.e. anything read from the mock "server") is passed through `validateDashboardConfig` first, which:

- drops widgets with unknown `dataSource` values
- fills in missing `title`/`layout`/etc. from the module catalog when the `id` matches a known one
- clamps `layout.width`/`layout.height` into valid ranges
- resyncs `order` from whatever hint survived normalization
- falls back to `getDefaultConfigForRole(role)` entirely if the payload is unusable
- migrates a recognized older schema version's field names/shapes into the current ones before any of the above runs — see section 11

This is what lets the renderer assume a well-formed config always, rather than defensively checking shapes everywhere.

## 5. Widget registry & rendering pipeline

Two parallel lookup tables keep `WidgetRenderer` free of `if`/`switch` on type:

- `widgetRegistry`: `WidgetType → component` (`KpiWidget`, `BarChartWidget`, `LineChartWidget`, `TableWidget`, `ListWidget`)
- `dataSourceRegistry` (`components/dashboard/dataSources.tsx`): `DataSourceKey → component`, where each component wraps exactly one RTK Query hook (hooks can't be called dynamically/conditionally, hence one tiny wrapper per source instead of one dynamic hook call)

`WidgetRenderer` composes both: resolve data source → fetch → resolve widget component → render inside `WidgetShell`, which supplies shared loading/empty/error chrome. This is the *only* rendering pipeline in the app — both `/dashboard` and the `/configure` live preview go through it, satisfying "do not create a separate rendering implementation for the preview."

## 6. `/configure`: the drag-and-drop builder

Two-panel layout (`AvailableWidgetsPanel` + `DashboardCanvas`) under one `dnd-kit` `DndContext`:

- **Add**: dragging a palette template and dropping it on the canvas dispatches `addWidget`, which stamps a fresh `id` and inserts at the drop position.
- **Reorder**: canvas cards are also draggable (`SortableContext`); dropping dispatches `reorderWidgets` with the new id order.
- **Remove**: a widget's ✕ dispatches `removeWidget`. It only removes that dashboard's config entry — the palette is a static list (`config/widgetPalette.ts`), untouched.
- **Configure**: selecting a canvas card opens `ConfigDrawer`, a right-side drawer (kept open alongside the canvas, per the brief's preference). Its fields are context-aware: filter/sort/metric options are looked up per `dataSource` from `FILTER_OPTIONS_BY_SOURCE`/`SORT_OPTIONS_BY_SOURCE`/`METRIC_OPTIONS` in `config/dashboardConfig.ts`, so only options meaningful for that widget's data source and type are shown.
- **Live preview**: the canvas *is* the preview — every card renders through the same `WidgetRenderer` described above, fed from `draftConfig`. Changing a widget's type, filter, or layout re-renders it immediately because it's the same Redux state driving both the card and the "preview."

## 7. Pagination / infinite scroll

`useInfiniteModules` owns the page cursor and exposes `modules`, `hasMore`, `loadMore`, `retry`. `getDashboardModules` (RTK Query) uses a custom `serializeQueryArgs` (keyed by role only, not role+page) and `merge` (append page 2+, replace on page 1) so all pages for a role live in one cache entry — this is what makes "don't refetch already-loaded pages" and "preserve existing modules on error" free rather than something the hook has to hand-manage. `LoadMoreSentinel` triggers `loadMore` via `IntersectionObserver`, both on scroll and when the loaded content is shorter than the viewport. A failed page keeps prior modules mounted and offers Retry, which only reissues the failed page's request.

## 8. Independent widget states & error isolation

Each widget fetches through its own `dataSourceRegistry` wrapper (its own RTK Query hook), so `WidgetShell` gives every widget an independent loading/empty/error/success state. One widget failing (including the built-in `SIMULATE_ERROR_VALUE` demo filter, in `types/dashboard.ts`) never touches its siblings — there is no shared fetch or shared error boundary across widgets.

## 9. Concurrent edits (optimistic concurrency)

`updateDashboardConfig` was originally last-write-wins: two saves for the same role with no ordering guarantee would silently overwrite each other, with no way to tell it had happened. Every `DashboardConfig` now carries a `revision`, an edit generation bumped by the server on every successful save (`data/mockApi.ts`). A save must include the `revision` it was loaded from; if the currently stored revision has already moved past that (someone else's save landed first), the save is rejected with `CONFIG_CONFLICT_ERROR` instead of being applied — the revision check and the store write happen with no `await` between them, so there's no window for two saves to interleave. `ConfigurationPanel` shows a banner on conflict with a **Reload Latest** action that refetches the current config and reloads the draft from it, rather than silently discarding either side's work. `Reset` was also fixed to keep the currently-loaded revision (not a hardcoded default), so resetting and then saving isn't mistaken for a conflict with yourself.

This is proven at the unit level (`data/mockApi.test.ts`): a save on the current revision succeeds and bumps it; a save on a stale revision is rejected *and* leaves the already-saved config untouched; a retried save with the fresh revision then succeeds. It is **not** currently demonstrable across two real browser tabs, though: `fakeBaseQuery` means the mock API runs entirely client-side, so `configStore` is a plain in-memory module variable per page load — two tabs each get their own copy, with nothing (no `localStorage`, no `BroadcastChannel`) syncing them. Two people editing the same dashboard can't actually collide in the app as it stands, independent of this feature. The check is still correct and load-bearing: it activates automatically the moment the mock API is swapped for anything with real shared state (a real backend, or even just moving `configStore` into `localStorage` + a `storage` listener to make it cross-tab within one browser).

## 10. Undo/redo (local editing history)

`draftConfig`, `isDirty`, `past`, and `future` (widget-array snapshots) all live in `dashboardSlice.ts`. Every widget-content-mutating reducer (visibility, type, data source, filter, sort, metric, layout, add, remove, reorder, and Reset) pushes the pre-change `widgets` array onto `past` and clears `future` before applying the change. `undo`/`redo` pop from one stack, push the current state onto the other, and restore. Only `widgets` is ever snapshotted — `role`/`version`/`updatedAt`/`revision` always stay at their current/latest value, which is what keeps this compatible with the optimistic-concurrency check in section 9: undoing after a save just reverts widget content locally, and a subsequent Save still checks against the correct (unchanged) revision.

A few deliberate choices:

- **Reset is itself undoable.** Given the goal — recovering from an accidental or "ruined" edit — an accidental Reset click is exactly the scenario this needs to protect against, so it pushes history like any other edit rather than clearing it.
- **A fresh load clears history, a save does not.** `loadDraftConfig` (the initial per-role fetch, and "Reload Latest" after a save conflict) and switching roles both clear `past`/`future`, since old snapshots can't reliably apply against a different role's or a different server revision's widgets. Saving, by contrast, does *not* clear history — a bad save is still locally undoable and re-saveable.
- **Consecutive edits to the same widget's title coalesce into one undo step**, tracked via `coalescingTitleWidgetId` (reset by any other action). Without this, typing a title would produce one undo step per keystroke; verified live (see below) that a full retyped title undoes in a single step, not character by character.
- **Undo/redo are also on the keyboard** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), but the handler checks `document.activeElement` and does nothing while focus is in an input/textarea/select/contenteditable — otherwise it would hijack the browser's native undo inside the title field, or interfere with a `<select>`.
- **`past` is capped at `MAX_HISTORY` (50) steps**, oldest dropped first, so a long editing session can't grow history unboundedly. `future` needs no separate cap — it only grows by moving entries out of `past` via undo, so it's already bounded by the same limit.

Covered by `store/dashboardSlice.test.ts` (undo/redo, no-op when empty, branching discards stale redo on a new edit, coalescing, Reset recoverability, history clearing on load/role-switch, history surviving a save) and `components/configuration/ConfigurationPanel.test.tsx` (button enabled/disabled state through an edit → undo → redo cycle).

## 11. Schema drift (config version migration)

`validateDashboardConfig` accepts `version: number` at face value but never used to *do* anything with it — it always stamped the output as `CURRENT_CONFIG_VERSION` without checking whether the incoming shape actually matched. That's "tolerates old versions without crashing," which isn't the same as "handles old configuration versions" (brief, section 21): if an older saved config used different field names, the validator would treat those old names as *missing* and silently fall back to the module catalog's defaults (or drop the field entirely) — a user's saved customization quietly reverting with no error and no test proving that was even the actual behavior.

This codebase has only ever had one real schema, so there was no genuine prior version to migrate from. `CURRENT_CONFIG_VERSION` is now `2`, and version `1` is defined (retroactively, as a worked example — not real history) as having used `type` instead of `widgetType` and `size: {w, h}` instead of `layout: {width, height}`. `migrateConfigV1ToV2` (`lib/configValidator.ts`) runs before normalization when `raw.version === 1`, translating those old names into the current shape so the user's actual saved values survive rather than reverting to catalog defaults. It covers two different kinds of drift deliberately — a flat rename and a nested reshape — rather than just the trivial case. Only `version === 1` is recognized; anything else (missing version, an unrecognized future version) falls through to the existing best-effort normalization unchanged, by design — this is a single explicit migration step, not a general version-chain migration engine, since there's only one historical shape to migrate from today.

Proven in `lib/configValidator.test.ts`: a v1-shaped widget with a *non-default* title/layout/filter survives migration with those exact values intact (not the module catalog's defaults, which would be silently substituted if migration weren't running); a widget carrying both old and new field names prefers the current one; and versions other than `1` are confirmed to *not* trigger migration, falling back to catalog defaults for the unrecognized old field names as before.

## 12. Responsive layout

`layout.width`/`layout.height` on each widget are arbitrary (1–12 / 1–4), but `lib/layoutBuckets.ts` snaps them into a fixed set of grid-span buckets (`[3,4,6,8,12]` widths, clamped 1–4 heights) that the shared `DashboardGrid.module.css` actually implements. Responsiveness is this one grid definition reflowing at different viewport widths — there's no separate per-breakpoint layout to keep in sync, and the `/configure` canvas imports the same CSS module rather than a copy, so the builder preview matches `/dashboard` pixel-for-pixel.

## 13. Trade-offs & deliberate scope cuts

This is a prototype, and some things were intentionally kept simple rather than "production-complete":

- **Persistence**: an in-memory `Map<Role, DashboardConfig>` in `data/mockApi.ts`, not a database — this is explicit in the brief ("do not build a real backend or database", "do not make localStorage the primary source of truth"). Since `fakeBaseQuery` runs the mock API entirely client-side, this store is per browser tab: it resets on refresh/tab close and is never shared across tabs (see section 9); that's expected for a prototype with no real backend.
- **No auth**: role selection is a client-side dropdown, not an authenticated session. There's no access control preventing a user from switching roles.
- **Table/List columns are fixed per data source**, not user-configurable — the brief's per-widget-type config lists "Columns"/"Display Fields" as options; here they're derived from the data source rather than exposed as pickable fields, to avoid a column-picker UI that isn't otherwise load-bearing for the demo flow.
- **No widget-level pagination** for Table widgets — only dashboard-level module pagination (section 12–16 of the brief) is implemented; a Table widget renders all rows its data source returns.
- **Filter/sort/metric are fixed enumerated options per data source** (`FILTER_OPTIONS_BY_SOURCE` etc.), not a freeform query builder.
- **Concurrent-edit conflicts are proven at the unit level, not cross-tab** — see section 9. The mock API's client-side, per-tab storage is the limiting factor here, not the concurrency logic itself.
- **Undo/redo history is in-memory only** — it doesn't survive a page reload or a role switch (see section 10). It's capped at `MAX_HISTORY` (50) steps, oldest dropped first, so a very long editing session can't grow it unboundedly; both match the brief's own framing ("a local editing history for the current draft," not a full collaborative history system).
- **The schema-drift migration (section 11) is a worked example, not real history** — this app has only ever had one real schema. It proves the *mechanism* (a version-gated migration step preserves renamed/reshaped data instead of silently defaulting it), not an actual historical rename. It's also a single explicit step rather than a general version-chain engine, since only one prior version is defined.

## 14. What would change with more time

- Swap `fakeBaseQuery` for `fetchBaseQuery` against a real API (the seam described in section 2 is designed for exactly this) — this is also what would let the concurrency check in section 9 actually be exercised across two real users.
- Alternatively, back `configStore` with `localStorage` + a `storage` event listener so the conflict flow is at least demonstrable across two tabs in one browser without a real backend.
- Make Table/List column selection configurable per widget rather than fixed per data source.
- Add real authentication and make role a property of the authenticated user rather than a free dropdown.
- The one remaining coverage gap: a drag-and-drop add/reorder flow end-to-end test (dnd-kit's pointer-based drag events are the hard part to simulate realistically in jsdom). Current coverage: `store/dashboardSlice.test.ts` (builder UX, undo/redo, history cap), `lib/configValidator.test.ts` (hostile input, schema-version migration), `components/dashboard/WidgetShell.test.tsx` (loading/empty/error/success presentation), `components/dashboard/WidgetRenderer.test.tsx` (unsupported widget/data source, real loading→success and loading→error via RTK Query, sibling-widget error isolation), `components/configuration/ConfigurationPanel.test.tsx` (role switching, undo/redo buttons, save-conflict preserving the local draft), `data/mockApi.test.ts` (optimistic concurrency), `hooks/useInfiniteModules.test.tsx` (next page, end of pagination, duplicate-request prevention, failed page, retry).
