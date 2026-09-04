# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run a production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

There is no test suite or type-check script configured. Use `npx tsc --noEmit` to type-check manually; `tsconfig.tsbuildinfo`/`.next` are build artifacts, not sources of truth.

## Architecture

This is a prototype **configuration-driven operations dashboard**: which widgets a role sees, in what order, with what filter/sort/metric, is data (`DashboardConfig`), not markup. Two pages read/write that data:

- `/dashboard` (`components/dashboard/Dashboard.tsx`) — renders a role's *saved* config, paginated.
- `/configure` (`components/configuration/ConfigurationPanel.tsx`) — a drag-and-drop builder (dnd-kit) that edits a *draft* of that config and can save it back.

### No real backend

`data/mockApi.ts` is the only place that touches "server" data (`data/mockData.ts` + an in-memory `Map<Role, DashboardConfig>` for saved configs). Every function simulates latency (`delay()`) and can throw. `store/api/dashboardApi.ts` wraps each mock function in an RTK Query endpoint via `fakeBaseQuery`, so the rest of the app gets real caching/loading/error/invalidation semantics — swapping in a real HTTP backend later only touches this one file's `queryFn`s.

Selecting a filter option with value `SIMULATE_ERROR_VALUE` (`types/dashboard.ts`) deliberately throws in the mock API — this is the built-in way to exercise error states in the UI.

### Redux state split

- **`store/api/dashboardApi.ts`** (RTK Query) owns all server-shaped data: the five data sources, `getDashboardConfig`/`updateDashboardConfig`, and paginated `getDashboardModules`.
- **`store/dashboardSlice.ts`** owns UI-only state: `selectedRole` and a `draftConfig` (the in-progress, possibly-unsaved edit on `/configure`). The draft *is* the live preview — the canvas renders directly from `draftConfig`, nothing is duplicated for previewing.
- Every widget-array mutation in the slice (`addWidget`, `removeWidget`, `reorderWidgets`) resyncs each widget's `order` field to its array index — `order` is the single source of truth for placement, so never write it independently elsewhere.

### Registry pattern (no switch/if-else on type)

Two parallel lookup tables keep the rendering pipeline branch-free — adding a new widget type or data source means adding one entry to each, not touching the renderer:

- `config/widgetRegistry.ts`: `WidgetType -> component` (`KpiWidget`, `BarChartWidget`, …)
- `components/dashboard/dataSources.tsx`: `DataSourceKey -> component` wrapping exactly one RTK Query hook each (hooks can't be called dynamically, hence one wrapper component per source)

`components/dashboard/WidgetRenderer.tsx` composes both lookups: resolve data source → fetch → resolve widget component → render inside `WidgetShell` (shared loading/empty/error chrome). This is the *only* render pipeline; both `/dashboard` and the `/configure` canvas preview go through it.

### Config lifecycle

`config/dashboardConfig.ts` defines `MODULE_CATALOG` (every widget the app knows about) and per-role defaults (`getDefaultConfigForRole`). Anything read from storage/network first goes through `lib/configValidator.ts`'s `validateDashboardConfig`, which normalizes an arbitrary/malformed/older-schema payload into a well-formed `DashboardConfig`, falling back to role defaults rather than throwing — never assume a `DashboardConfig` in hand is well-formed without going through this path if it didn't come from the store.

### Pagination

`/dashboard` loads modules page-by-page (`hooks/useInfiniteModules.ts`, `PAGE_SIZE = 9`) via `getDashboardModules`, which RTK Query accumulates into one cache entry per role (custom `serializeQueryArgs`/`merge` in `dashboardApi.ts`) rather than one entry per page. `LoadMoreSentinel` (IntersectionObserver) triggers `loadMore` both on scroll and when loaded content doesn't yet fill the viewport.

### Layout grid

Widgets declare an arbitrary `layout: {width, height}` (1–12 / 1–4), but the actual CSS grid only supports fixed buckets. `lib/layoutBuckets.ts` snaps to the nearest supported width bucket (`[3,4,6,8,12]`) and clamps height (`1–4`). The `/configure` canvas (`DashboardCanvas.tsx`) imports `DashboardGrid.module.css` directly from the dashboard component rather than duplicating grid CSS, so the builder preview matches `/dashboard` pixel-for-pixel.

### Path alias

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/types/dashboard`, `@/store/hooks`.
