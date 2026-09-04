# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run a production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

There is no test suite or type-check script configured. Use `npx tsc --noEmit` to type-check manually; `tsconfig.tsbuildinfo`/`.next` are build artifacts, not sources of truth.

## Project goal

This is a prototype built from a spec ("Build a Configuration-Driven Operations Dashboard") whose non-negotiable principle is:

> Data, presentation, layout, permissions, client state, server state, and module loading are separate concerns. The dashboard component must not need to change when a widget is hidden/shown, a widget's type changes, a role is added, a module is added, the layout changes, more pages load, or the mock API is replaced by a real backend.

Concretely, that means: never add an `if`/`switch` on `widgetType` or `dataSource` outside the two registries (see below); never hardcode a per-role dashboard; never give the `/configure` preview its own rendering path; and don't treat this as a place to "just quickly special-case" a widget or role.

## Architecture

Which widgets a role sees, in what order, with what filter/sort/metric, is data (`DashboardConfig`), not markup. Two pages read/write that data:

- `/dashboard` (`components/dashboard/Dashboard.tsx`) — renders a role's *saved* config, paginated.
- `/configure` (`components/configuration/ConfigurationPanel.tsx`) — a drag-and-drop builder (dnd-kit) that edits a *draft* of that config and can save it back. Its live preview is not a separate implementation — it's the same `WidgetRenderer`/registries as `/dashboard`, fed from `draftConfig` instead of the saved config.

### No real backend

`data/mockApi.ts` is the only place that touches "server" data (`data/mockData.ts` + an in-memory `Map<Role, DashboardConfig>` for saved configs, i.e. **not** `localStorage` — the spec explicitly rules out localStorage as the source of truth). Every function simulates latency (`delay()`) and can throw. `store/api/dashboardApi.ts` wraps each mock function in an RTK Query endpoint via `fakeBaseQuery`, so the rest of the app gets real caching/loading/error/invalidation semantics — swapping in a real HTTP backend later should only touch this one file's `queryFn`s.

Selecting a filter option with value `SIMULATE_ERROR_VALUE` (`types/dashboard.ts`) deliberately throws in the mock API — this is the built-in way to exercise per-widget error states in the UI (see Independent widget states below).

### Redux state split

- **`store/api/dashboardApi.ts`** (RTK Query) owns all server-shaped data: the five data sources (customers, transactions, revenue, orders, payments), `getDashboardConfig`/`updateDashboardConfig`, and paginated `getDashboardModules`.
- **`store/dashboardSlice.ts`** owns UI-only state: `selectedRole` and a `draftConfig` (the in-progress, possibly-unsaved edit on `/configure`). The draft *is* the live preview — the canvas renders directly from `draftConfig`, nothing is duplicated for previewing.
- Every widget-array mutation in the slice (`addWidget`, `removeWidget`, `reorderWidgets`) resyncs each widget's `order` field to its array index — `order` is the single source of truth for placement, so never write it independently elsewhere.

### Registry pattern (no switch/if-else on type)

Two parallel lookup tables keep the rendering pipeline branch-free — adding a new widget type or data source means adding one entry to each, not touching the renderer:

- `config/widgetRegistry.ts`: `WidgetType -> component` (`KpiWidget`, `BarChartWidget`, `LineChartWidget`, `TableWidget`, `ListWidget`)
- `components/dashboard/dataSources.tsx`: `DataSourceKey -> component` wrapping exactly one RTK Query hook each (hooks can't be called dynamically, hence one wrapper component per source)

`components/dashboard/WidgetRenderer.tsx` composes both lookups: resolve data source → fetch → resolve widget component → render inside `WidgetShell` (shared loading/empty/error chrome). This is the *only* render pipeline; both `/dashboard` and the `/configure` canvas preview go through it. Same data (e.g. `transactions`) must stay renderable as a KPI, bar chart, line chart, table, or list — presentation is purely a function of `widgetType`, not baked into the data source.

### Config lifecycle & validation

`config/dashboardConfig.ts` defines `MODULE_CATALOG` (every widget the app knows about) and per-role defaults (`getDefaultConfigForRole`) — role-based visibility is expressed as data (`ROLE_MODULE_IDS`), not as separate hardcoded dashboards per role. Anything read from storage/network first goes through `lib/configValidator.ts`'s `validateDashboardConfig`, which normalizes an arbitrary/malformed/older-schema payload (missing properties, invalid layouts, unknown data sources, stale `order`) into a well-formed `DashboardConfig`, falling back to role defaults rather than throwing — never assume a `DashboardConfig` in hand is well-formed without going through this path if it didn't come from the store. An unresolvable `widgetType` renders `UnsupportedWidget` instead of crashing.

### Independent widget states

Each widget fetches its own data independently through its own RTK Query hook (see registry pattern above), so `WidgetShell` gives every widget its own loading/empty/error/success state — one widget's `SIMULATE_ERROR_VALUE` failure never affects sibling widgets or crashes the dashboard.

### Pagination

`/dashboard` loads modules page-by-page (`hooks/useInfiniteModules.ts`, `PAGE_SIZE = 9`) via `getDashboardModules`, which RTK Query accumulates into one cache entry per role (custom `serializeQueryArgs`/`merge` in `dashboardApi.ts`) rather than one entry per page — this is what makes "append, don't refetch already-loaded pages" work. `LoadMoreSentinel` (IntersectionObserver) triggers `loadMore` both on scroll and when loaded content doesn't yet fill the viewport. A failed page keeps already-loaded modules visible and offers Retry without discarding state.

### Layout grid

Widgets declare an arbitrary `layout: {width, height}` (1–12 / 1–4), but the actual CSS grid only supports fixed buckets. `lib/layoutBuckets.ts` snaps to the nearest supported width bucket (`[3,4,6,8,12]`) and clamps height (`1–4`). The `/configure` canvas (`DashboardCanvas.tsx`) imports `DashboardGrid.module.css` directly from the dashboard component rather than duplicating grid CSS, so the builder preview matches `/dashboard` pixel-for-pixel. Responsiveness comes from this one grid definition reflowing at different viewport widths, not from separate per-breakpoint layouts.

### Path alias

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/types/dashboard`, `@/store/hooks`.
